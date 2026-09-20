import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, asService, asUser, createDatabase } from "./database";
import { addMember, createTenant, insertDebtor, insertInvoice, type Tenant } from "./fixtures";

/** Moteur de relance (palier 10) : relances gérées par le serveur, validation humaine (§2.3). */
describe("relances", () => {
  let db: PGlite;
  let tenant: Tenant;
  let other: Tenant;
  let debtorId: string;
  let invoiceCounter = 0;

  const newInvoice = async (debtor = debtorId) => {
    invoiceCounter += 1;
    return insertInvoice(db, tenant.organizationId, debtor, `R-${invoiceCounter}`);
  };

  /** Relance préparée par le serveur (clé de service). */
  const planReminder = async (
    invoiceId: string,
    { status = "awaiting_approval", aiGenerated = true, body = "Merci de régler la facture.", scheduledAt = "now()" } = {},
  ) => {
    const { rows } = await asService(db, (tx) =>
      tx.query<{ id: string }>(
        `insert into reminders (organization_id, invoice_id, scheduled_at, status, ai_generated, subject, body)
         values ($1, $2, ${scheduledAt}, $3, $4, 'Relance', $5) returning id`,
        [tenant.organizationId, invoiceId, status, aiGenerated, body],
      ),
    );
    return rows[0]?.id ?? "";
  };

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Relances");
    other = await createTenant(db, "Autre Atelier");
    debtorId = await insertDebtor(db, tenant.organizationId);
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("un membre ne crée ni ne modifie une relance directement", async () => {
    const invoiceId = await newInvoice();

    await expect(
      asUser(db, tenant.userId, (tx) =>
        tx.query("insert into reminders (organization_id, invoice_id, scheduled_at) values ($1, $2, now())", [
          tenant.organizationId,
          invoiceId,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("§2.3 : une première relance IA pour un débiteur ne peut pas partir sans validation humaine", async () => {
    const invoiceId = await newInvoice();

    await expect(planReminder(invoiceId, { status: "scheduled" })).rejects.toThrow(/validation humaine/);
    const reminderId = await planReminder(invoiceId);
    await expect(
      asService(db, (tx) => tx.query("update reminders set status = 'scheduled' where id = $1", [reminderId])),
    ).rejects.toThrow(/validation humaine/);
  });

  it("une fois validée par un membre, elle est planifiée et signée par lui", async () => {
    const invoiceId = await newInvoice();
    const reminderId = await planReminder(invoiceId);

    await asUser(db, tenant.userId, (tx) => tx.query("select public.approve_reminder($1)", [reminderId]));

    const { rows } = await db.query<{ status: string; approved_by: string; approved: boolean }>(
      "select status::text, approved_by, approved_at is not null as approved from reminders where id = $1",
      [reminderId],
    );
    expect(rows[0]).toEqual({ status: "scheduled", approved_by: tenant.userId, approved: true });
    const audit = await db.query("select 1 from audit_logs where action = 'reminder.approved' and entity_id = $1", [reminderId]);
    expect(audit.rows).toHaveLength(1);
  });

  it("ensuite, les relances IA suivantes pour ce débiteur peuvent partir automatiquement", async () => {
    const invoiceId = await newInvoice();

    await expect(planReminder(invoiceId, { status: "scheduled" })).resolves.toBeTruthy();
  });

  it("une relance issue d'un modèle, sans IA, peut être planifiée directement", async () => {
    const freshDebtor = await insertDebtor(db, tenant.organizationId, { siren: "732829320" });
    const invoiceId = await newInvoice(freshDebtor);

    await expect(planReminder(invoiceId, { status: "scheduled", aiGenerated: false })).resolves.toBeTruthy();
  });

  it("le texte d'une relance obéit aux règles des modèles, selon le débiteur (§2.5, §2.6)", async () => {
    const invoiceId = await newInvoice();
    const consumer = await insertDebtor(db, tenant.organizationId, { clientType: "b2c", siren: null, isLegalEntity: false });
    const consumerInvoice = await newInvoice(consumer);

    await expect(planReminder(invoiceId, { body: "Un huissier passera." })).rejects.toThrow(/Relance refusée/);
    await expect(planReminder(consumerInvoice, { body: "Une indemnité forfaitaire de 40 € s'applique." })).rejects.toThrow(
      /Relance refusée/,
    );

    const reminderId = await planReminder(invoiceId);
    await expect(
      asUser(db, tenant.userId, (tx) =>
        tx.query("select public.approve_reminder($1, null, 'Nous saisirons le tribunal.')", [reminderId]),
      ),
    ).rejects.toThrow(/Relance refusée/);
  });

  it("une étape n'a qu'une relance active par facture", async () => {
    const { rows: steps } = await db.query<{ id: string }>(
      `insert into reminder_sequences (organization_id, name, client_type) values ($1, 'S', 'b2b') returning id`,
      [tenant.organizationId],
    );
    const { rows: step } = await db.query<{ id: string }>(
      `insert into reminder_steps (organization_id, sequence_id, position, offset_days, tone)
       values ($1, $2, 1, 5, 'courtois') returning id`,
      [tenant.organizationId, steps[0]?.id],
    );
    const invoiceId = await newInvoice();
    const insertForStep = () =>
      asService(db, (tx) =>
        tx.query(
          `insert into reminders (organization_id, invoice_id, step_id, scheduled_at, status) values ($1, $2, $3, now(), 'awaiting_approval')`,
          [tenant.organizationId, invoiceId, step[0]?.id],
        ),
      );

    await insertForStep();
    await expect(insertForStep()).rejects.toThrow(/reminders_active_step_key/);
  });

  it("annulation : sa propre relance en attente seulement", async () => {
    const invoiceId = await newInvoice();
    const reminderId = await planReminder(invoiceId);

    await expect(
      asUser(db, other.userId, (tx) => tx.query("select public.cancel_reminder($1)", [reminderId])),
    ).rejects.toThrow(/introuvable/);
    await asUser(db, tenant.userId, (tx) => tx.query("select public.cancel_reminder($1)", [reminderId]));
    await expect(
      asUser(db, tenant.userId, (tx) => tx.query("select public.cancel_reminder($1)", [reminderId])),
    ).rejects.toThrow(/ne peut plus être annulée/);
  });

  it("l'envoi réserve les relances dues une seule fois, puis enregistre le résultat au nom du système", async () => {
    await db.query("update reminders set status = 'cancelled' where status = 'scheduled'");
    const invoiceId = await newInvoice();
    const dueId = await planReminder(invoiceId, { status: "scheduled", aiGenerated: false });
    await planReminder(await newInvoice(), { status: "scheduled", aiGenerated: false, scheduledAt: "now() + interval '1 day'" });

    const claim = () =>
      asService(db, async (tx) => (await tx.query<{ id: string }>("select id from public.claim_due_reminders(10)")).rows);
    expect(await claim()).toEqual([{ id: dueId }]);
    expect(await claim()).toEqual([]);

    await asService(db, (tx) => tx.query("select public.record_reminder_result($1, true, 'msg-1')", [dueId]));
    const { rows } = await db.query<{ status: string; sent: boolean; provider_message_id: string }>(
      "select status::text, sent_at is not null as sent, provider_message_id from reminders where id = $1",
      [dueId],
    );
    expect(rows[0]).toEqual({ status: "sent", sent: true, provider_message_id: "msg-1" });
    const audit = await db.query<{ actor_type: string }>(
      "select actor_type::text from audit_logs where action = 'reminder.sent' and entity_id = $1",
      [dueId],
    );
    expect(audit.rows).toEqual([{ actor_type: "system" }]);
  });

  it("une relance annulée pendant son envoi est quand même notée envoyée, et tracée comme telle", async () => {
    await db.query("update reminders set status = 'cancelled' where status = 'scheduled'");
    const invoiceId = await newInvoice();
    const reminderId = await planReminder(invoiceId, { status: "scheduled", aiGenerated: false });
    await asService(db, (tx) => tx.query("select id from public.claim_due_reminders(10)"));

    // La facture est réglée pendant que le message part : le déclencheur annule la relance.
    await asUser(db, tenant.userId, (tx) =>
      tx.query("select public.change_invoice_status($1, 'mark_paid', current_date)", [invoiceId]),
    );
    await asService(db, (tx) => tx.query("select public.record_reminder_result($1, true, 'msg-2')", [reminderId]));

    const { rows } = await db.query<{ status: string; after_cancel: boolean }>(
      `select reminder.status::text, (log.payload->>'after_cancel')::boolean as after_cancel
       from reminders as reminder join audit_logs as log on log.entity_id = reminder.id and log.action = 'reminder.sent'
       where reminder.id = $1`,
      [reminderId],
    );
    expect(rows).toEqual([{ status: "sent", after_cancel: true }]);

    // Un échec sur une relance annulée n'a rien à enregistrer.
    const idle = await planReminder(await newInvoice(), { status: "scheduled", aiGenerated: false });
    await db.query("update reminders set status = 'cancelled' where id = $1", [idle]);
    await expect(
      asService(db, (tx) => tx.query("select public.record_reminder_result($1, true, 'msg-3')", [idle])),
    ).rejects.toThrow(/déjà traitée/);
  });

  it("ces fonctions d'envoi sont réservées au serveur", async () => {
    await expect(
      asUser(db, tenant.userId, (tx) => tx.query("select * from public.claim_due_reminders(10)")),
    ).rejects.toThrow(/permission denied/);
  });

  it("l'envoi automatique ne se règle que par le propriétaire ou un administrateur", async () => {
    const memberId = await addMember(db, tenant.organizationId, "member");

    const byMember = await asUser(db, memberId, async (tx) => (await tx.query("update organizations set auto_send = true")).affectedRows);
    const byOwner = await asUser(db, tenant.userId, async (tx) => (await tx.query("update organizations set auto_send = true")).affectedRows);

    expect({ byMember, byOwner }).toEqual({ byMember: 0, byOwner: 1 });
  });
});
