import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_PROMISE_HORIZON_DAYS } from "@/lib/replies/promise-date";
import { PROMISE_GRACE_DAYS } from "@/lib/replies/promises";
import { DB_TEST_TIMEOUT_MS, asService, asUser, createDatabase } from "./database";
import { addMember, createTenant, insertDebtor, insertInvoice, type Tenant } from "./fixtures";

/** Réponses des clients et promesses de règlement (palier 11, §5.6). */
describe("réponses et promesses", () => {
  let db: PGlite;
  let tenant: Tenant;
  let other: Tenant;
  let debtorId: string;
  let counter = 0;

  const PARIS_TODAY = "(now() at time zone 'Europe/Paris')::date";

  /**
   * Facture échue le 31/08/2026 (statut enregistré « pending », affiché « en retard ») et relance
   * envoyée, comme après le palier 10. La base n'écrit « late » que lorsqu'elle recalcule le statut.
   */
  const sentReminder = async (organizationId = tenant.organizationId, debtor = debtorId) => {
    counter += 1;
    const invoiceId = await insertInvoice(db, organizationId, debtor, `REP-${counter}`);
    const { rows } = await db.query<{ id: string }>(
      `insert into reminders (organization_id, invoice_id, scheduled_at, sent_at, status, subject, body)
       values ($1, $2, now() - interval '1 day', now() - interval '1 day', 'sent', 'Relance', 'Merci de régler.') returning id`,
      [organizationId, invoiceId],
    );
    return { invoiceId, reminderId: rows[0]?.id ?? "" };
  };

  /** Relance suivante déjà préparée pour la facture. */
  const plannedReminder = async (invoiceId: string) => {
    const { rows } = await db.query<{ id: string }>(
      `insert into reminders (organization_id, invoice_id, scheduled_at, status, subject, body)
       values ($1, $2, now() + interval '2 days', 'awaiting_approval', 'Relance 2', 'Merci de régler.') returning id`,
      [tenant.organizationId, invoiceId],
    );
    return rows[0]?.id ?? "";
  };

  type ReplyArgs = {
    reminderId: string;
    kind: string;
    messageId?: string;
    excerpt?: string | null;
    promisedDateSql?: string;
    promisedAmount?: number | null;
    organizationId?: string;
    isAi?: boolean;
    confidence?: number;
  };

  const recordReply = ({
    reminderId,
    kind,
    messageId,
    excerpt = "Réponse du client.",
    promisedDateSql = "null",
    promisedAmount = null,
    organizationId,
    isAi = false,
    confidence = 0.8,
  }: ReplyArgs) =>
    asService(db, async (tx) => {
      const { rows } = await tx.query<{ id: string | null }>(
        `select public.record_reply($1, $2, $3, now(), $4::public.reply_kind, $5, $6, $8, ${promisedDateSql}, $7) as id`,
        [organizationId ?? tenant.organizationId, reminderId, messageId ?? crypto.randomUUID(), kind, excerpt, isAi, promisedAmount, confidence],
      );
      return rows[0]?.id ?? null;
    });

  const invoiceState = async (invoiceId: string) => {
    const { rows } = await db.query<{ status: string; paused: boolean }>(
      "select status::text, reminders_paused_at is not null as paused from invoices where id = $1",
      [invoiceId],
    );
    return rows[0];
  };

  const reminderStatus = async (reminderId: string) => {
    const { rows } = await db.query<{ status: string }>("select status::text from reminders where id = $1", [reminderId]);
    return rows[0]?.status;
  };

  const replyState = async (replyId: string | null) => {
    const { rows } = await db.query<{ status: string; excerpt: string | null; handled_by: string | null }>(
      "select status::text, excerpt, handled_by from replies where id = $1",
      [replyId],
    );
    return rows[0];
  };

  const promisesOf = async (invoiceId: string) => {
    const { rows } = await db.query<{ source: string; kept: boolean | null; amount: string | null; reply_id: string | null }>(
      "select source::text, kept, promised_amount::text as amount, reply_id from promises where invoice_id = $1 order by created_at",
      [invoiceId],
    );
    return rows;
  };

  const auditActions = async (entityId: string) => {
    const { rows } = await db.query<{ action: string }>(
      "select action from audit_logs where entity_id = $1 or payload->>'invoice_id' = $1::text order by id",
      [entityId],
    );
    return rows.map((row) => row.action);
  };

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Réponses");
    other = await createTenant(db, "Autre Atelier");
    debtorId = await insertDebtor(db, tenant.organizationId);
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it(`le délai de grâce est le même en base et dans l'application (${PROMISE_GRACE_DAYS} jours)`, async () => {
    const { rows } = await db.query<{ days: number }>("select private.promise_grace_days() as days");

    expect(rows[0]?.days).toBe(PROMISE_GRACE_DAYS);
  });

  it(`l'horizon d'une promesse détectée est le même en base et dans l'application (${MAX_PROMISE_HORIZON_DAYS} jours)`, async () => {
    const { rows } = await db.query<{ days: number }>("select private.max_promise_horizon_days() as days");

    expect(rows[0]?.days).toBe(MAX_PROMISE_HORIZON_DAYS);
  });

  describe("enregistrement d'une réponse (clé de service)", () => {
    it("une promesse datée met la facture sous promesse et annule la relance suivante", async () => {
      const { invoiceId, reminderId } = await sentReminder();
      const nextId = await plannedReminder(invoiceId);

      const replyId = await recordReply({ reminderId, kind: "promise", promisedDateSql: `${PARIS_TODAY} + 7`, promisedAmount: 600, isAi: true });

      expect(await invoiceState(invoiceId)).toEqual({ status: "promised", paused: false });
      expect(await reminderStatus(nextId)).toBe("cancelled");
      expect(await promisesOf(invoiceId)).toEqual([{ source: "email_reply", kept: null, amount: "600.00", reply_id: replyId }]);
      // La réponse reste à traiter : un membre voit la promesse que Relia en a déduite.
      expect(await replyState(replyId)).toMatchObject({ status: "new" });
      expect(await auditActions(invoiceId)).toEqual(
        expect.arrayContaining(["invoice.status_changed", "promise.recorded", "reply.received"]),
      );
      const { rows } = await db.query<{ actor: string }>("select actor_type::text as actor from audit_logs where entity_id = $1", [replyId]);
      expect(rows[0]?.actor).toBe("ai");
    });

    it("une promesse peu sûre n'est pas appliquée d'office : la facture est mise en pause", async () => {
      const { invoiceId, reminderId } = await sentReminder();

      await recordReply({ reminderId, kind: "promise", promisedDateSql: `${PARIS_TODAY} + 7`, confidence: 0.5 });

      expect(await invoiceState(invoiceId)).toEqual({ status: "pending", paused: true });
      expect(await promisesOf(invoiceId)).toEqual([]);
    });

    it("après une promesse rompue, la suivante attend la décision d'un membre", async () => {
      const { invoiceId, reminderId } = await sentReminder();
      await db.query(
        "insert into promises (organization_id, invoice_id, promised_date, source, kept) values ($1, $2, current_date - 20, 'email_reply', false)",
        [tenant.organizationId, invoiceId],
      );

      await recordReply({ reminderId, kind: "promise", promisedDateSql: `${PARIS_TODAY} + 7`, confidence: 0.95 });

      expect(await invoiceState(invoiceId)).toEqual({ status: "pending", paused: true });
      expect(await promisesOf(invoiceId)).toHaveLength(1);
    });

    it("une relance ne se prépare ni ne se valide pour une facture en pause ou sous promesse", async () => {
      const paused = await sentReminder();
      await recordReply({ reminderId: paused.reminderId, kind: "other" });
      const promised = await sentReminder();
      await db.query("update invoices set status = 'promised' where id = $1", [promised.invoiceId]);

      await expect(plannedReminder(paused.invoiceId)).rejects.toThrow(/Relances suspendues/);
      await expect(plannedReminder(promised.invoiceId)).rejects.toThrow(/plus à relancer/);
    });

    it("une contestation suspend les relances de la facture et attend un membre", async () => {
      const { invoiceId, reminderId } = await sentReminder();
      const nextId = await plannedReminder(invoiceId);

      const replyId = await recordReply({ reminderId, kind: "dispute", excerpt: "Je conteste le montant." });

      expect(await invoiceState(invoiceId)).toEqual({ status: "pending", paused: true });
      expect(await reminderStatus(nextId)).toBe("cancelled");
      expect(await replyState(replyId)).toMatchObject({ status: "new", excerpt: "Je conteste le montant." });
    });

    it("un message d'absence est classé sans effet, et sans extrait conservé", async () => {
      const { invoiceId, reminderId } = await sentReminder();
      const nextId = await plannedReminder(invoiceId);

      const replyId = await recordReply({ reminderId, kind: "auto_reply", excerpt: "Absent, joignable au 06 12 34 56 78." });

      expect(await invoiceState(invoiceId)).toEqual({ status: "pending", paused: false });
      expect(await reminderStatus(nextId)).toBe("awaiting_approval");
      expect(await replyState(replyId)).toMatchObject({ status: "handled", excerpt: null });
    });

    it("une réponse déjà enregistrée ne l'est pas deux fois", async () => {
      const { reminderId } = await sentReminder();
      const messageId = crypto.randomUUID();

      await expect(recordReply({ reminderId, kind: "other", messageId })).resolves.toBeTruthy();
      await expect(recordReply({ reminderId, kind: "other", messageId })).resolves.toBeNull();
      const { rows } = await db.query("select 1 from replies where provider_message_id = $1", [messageId]);
      expect(rows).toHaveLength(1);
    });

    it("une réponse sur une facture réglée est gardée pour information, sans effet", async () => {
      const { invoiceId, reminderId } = await sentReminder();
      await db.query("update invoices set status = 'paid', paid_at = '2026-09-01' where id = $1", [invoiceId]);

      const replyId = await recordReply({ reminderId, kind: "promise", promisedDateSql: `${PARIS_TODAY} + 3` });

      expect(await invoiceState(invoiceId)).toEqual({ status: "paid", paused: false });
      expect(await promisesOf(invoiceId)).toEqual([]);
      expect(await replyState(replyId)).toMatchObject({ status: "new" });
    });

    it("refuse une relance non envoyée ou d'une autre organisation", async () => {
      const { invoiceId, reminderId } = await sentReminder();
      const plannedId = await plannedReminder(invoiceId);

      await expect(recordReply({ reminderId: plannedId, kind: "other" })).rejects.toThrow(/introuvable/);
      await expect(recordReply({ reminderId, kind: "other", organizationId: other.organizationId })).rejects.toThrow(/introuvable/);
    });

    it("refuse une date promise passée ou un montant supérieur à la facture", async () => {
      const { reminderId } = await sentReminder();

      await expect(recordReply({ reminderId, kind: "promise", promisedDateSql: `${PARIS_TODAY} - 2` })).rejects.toThrow(/Date de promesse/);
      await expect(
        recordReply({ reminderId, kind: "promise", promisedDateSql: `${PARIS_TODAY} + private.max_promise_horizon_days() + 1` }),
      ).rejects.toThrow(/Date de promesse/);
      await expect(
        recordReply({ reminderId, kind: "promise", promisedDateSql: `${PARIS_TODAY} + 2`, promisedAmount: 5000 }),
      ).rejects.toThrow(/Montant promis/);
    });

    it("un membre ne peut ni enregistrer une réponse, ni écrire dans les réponses ou les promesses", async () => {
      const { invoiceId, reminderId } = await sentReminder();

      await expect(
        asUser(db, tenant.userId, (tx) =>
          tx.query("select public.record_reply($1, $2, 'x', now(), 'other')", [tenant.organizationId, reminderId]),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(db, tenant.userId, (tx) =>
          tx.query(
            "insert into replies (organization_id, invoice_id, provider_message_id, received_at, kind) values ($1, $2, 'y', now(), 'other')",
            [tenant.organizationId, invoiceId],
          ),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(db, tenant.userId, (tx) =>
          tx.query(
            "insert into promises (organization_id, invoice_id, promised_date, source) values ($1, $2, current_date + 5, 'manual')",
            [tenant.organizationId, invoiceId],
          ),
        ),
      ).rejects.toThrow(/permission denied/);
    });

    it("un membre ne lit que les réponses de son organisation", async () => {
      const { reminderId } = await sentReminder();
      const replyId = await recordReply({ reminderId, kind: "other" });

      const own = await asUser(db, tenant.userId, (tx) => tx.query("select id from replies where id = $1", [replyId]));
      const foreign = await asUser(db, other.userId, (tx) => tx.query("select id from replies where id = $1", [replyId]));
      expect(own.rows).toHaveLength(1);
      expect(foreign.rows).toHaveLength(0);
    });
  });

  describe("traitement par un membre", () => {
    const resolve = (userId: string, replyId: string | null, resolution: string, paidAtSql = "null") =>
      asUser(db, userId, (tx) => tx.query(`select public.resolve_reply($1, $2, ${paidAtSql})`, [replyId, resolution]));

    it("« laisser en pause » classe la réponse sans reprendre les relances", async () => {
      const { invoiceId, reminderId } = await sentReminder();
      const replyId = await recordReply({ reminderId, kind: "other" });

      await resolve(tenant.userId, replyId, "keep_paused");

      expect(await replyState(replyId)).toEqual({ status: "handled", excerpt: "Réponse du client.", handled_by: tenant.userId });
      expect(await invoiceState(invoiceId)).toEqual({ status: "pending", paused: true });
    });

    it("« reprendre » lève la pause et classe toutes les réponses de la facture", async () => {
      const { invoiceId, reminderId } = await sentReminder();
      const first = await recordReply({ reminderId, kind: "other" });
      const second = await recordReply({ reminderId, kind: "other" });

      await resolve(tenant.userId, first, "resume");

      expect(await invoiceState(invoiceId)).toEqual({ status: "pending", paused: false });
      expect(await replyState(second)).toMatchObject({ status: "handled" });
      expect(await auditActions(invoiceId)).toContain("invoice.reminders_resumed");
    });

    it("« litige » passe la facture en litige ; « payée » note le règlement", async () => {
      const disputed = await sentReminder();
      const disputeReply = await recordReply({ reminderId: disputed.reminderId, kind: "dispute" });
      const paid = await sentReminder();
      const paidReply = await recordReply({ reminderId: paid.reminderId, kind: "paid_claim" });

      await resolve(tenant.userId, disputeReply, "dispute");
      await expect(resolve(tenant.userId, paidReply, "paid", `${PARIS_TODAY} + 1`)).rejects.toThrow(/futur/);
      await resolve(tenant.userId, paidReply, "paid", PARIS_TODAY);

      expect(await invoiceState(disputed.invoiceId)).toEqual({ status: "disputed", paused: false });
      expect(await invoiceState(paid.invoiceId)).toEqual({ status: "paid", paused: false });
      expect(await replyState(paidReply)).toMatchObject({ status: "handled" });
    });

    it("refuse une réponse déjà traitée, d'une autre organisation, ou une action inconnue", async () => {
      const { reminderId } = await sentReminder();
      const replyId = await recordReply({ reminderId, kind: "other" });

      await expect(resolve(other.userId, replyId, "resume")).rejects.toThrow(/introuvable/);
      await expect(resolve(tenant.userId, replyId, "delete")).rejects.toThrow(/Action inconnue/);
      await resolve(tenant.userId, replyId, "keep_paused");
      await expect(resolve(tenant.userId, replyId, "resume")).rejects.toThrow(/déjà été traitée/);
    });

    it("un simple membre peut traiter une réponse", async () => {
      const memberId = await addMember(db, tenant.organizationId, "member");
      const { reminderId } = await sentReminder();
      const replyId = await recordReply({ reminderId, kind: "other" });

      await expect(resolve(memberId, replyId, "keep_paused")).resolves.toBeTruthy();
    });
  });

  describe("promesses", () => {
    const recordPromise = (userId: string, invoiceId: string, dateSql: string, amount: number | null = null, replyId: string | null = null) =>
      asUser(db, userId, (tx) => tx.query(`select public.record_promise($1, ${dateSql}, $2, $3)`, [invoiceId, amount, replyId]));

    it("une promesse saisie depuis une réponse lève la pause et classe la réponse", async () => {
      const { invoiceId, reminderId } = await sentReminder();
      const replyId = await recordReply({ reminderId, kind: "other" });

      await recordPromise(tenant.userId, invoiceId, `${PARIS_TODAY} + 10`, 1200, replyId);

      expect(await invoiceState(invoiceId)).toEqual({ status: "promised", paused: false });
      expect(await promisesOf(invoiceId)).toEqual([{ source: "manual", kept: null, amount: "1200.00", reply_id: replyId }]);
      expect(await replyState(replyId)).toMatchObject({ status: "handled", handled_by: tenant.userId });
    });

    it("corriger la promesse détectée dans une réponse la remplace", async () => {
      const { invoiceId, reminderId } = await sentReminder();
      const replyId = await recordReply({ reminderId, kind: "promise", promisedDateSql: `${PARIS_TODAY} + 3` });

      await recordPromise(tenant.userId, invoiceId, `${PARIS_TODAY} + 12`, 500, replyId);

      expect(await promisesOf(invoiceId)).toEqual([{ source: "manual", kept: null, amount: "500.00", reply_id: replyId }]);
      expect(await invoiceState(invoiceId)).toEqual({ status: "promised", paused: false });
    });

    it("refuse une date passée, un montant trop élevé, une facture réglée ou d'une autre organisation", async () => {
      const { invoiceId } = await sentReminder();
      const paid = await sentReminder();
      await db.query("update invoices set status = 'paid', paid_at = '2026-09-01' where id = $1", [paid.invoiceId]);

      await expect(recordPromise(tenant.userId, invoiceId, `${PARIS_TODAY} - 1`)).rejects.toThrow(/Date de promesse/);
      await expect(recordPromise(tenant.userId, invoiceId, `${PARIS_TODAY} + 400`)).rejects.toThrow(/Date de promesse/);
      await expect(recordPromise(tenant.userId, invoiceId, `${PARIS_TODAY} + 5`, 1200.01)).rejects.toThrow(/Montant promis/);
      await expect(recordPromise(tenant.userId, paid.invoiceId, `${PARIS_TODAY} + 5`)).rejects.toThrow(/facture à régler/);
      await expect(recordPromise(other.userId, invoiceId, `${PARIS_TODAY} + 5`)).rejects.toThrow(/introuvable/);
    });

    it("reprendre les relances d'une facture sous promesse abandonne la promesse", async () => {
      const { invoiceId } = await sentReminder();
      await recordPromise(tenant.userId, invoiceId, `${PARIS_TODAY} + 10`);

      await asUser(db, tenant.userId, (tx) => tx.query("select public.resume_reminders($1)", [invoiceId]));

      expect(await invoiceState(invoiceId)).toEqual({ status: "late", paused: false });
      expect(await promisesOf(invoiceId)).toMatchObject([{ kept: false }]);
      await expect(asUser(db, tenant.userId, (tx) => tx.query("select public.resume_reminders($1)", [invoiceId]))).rejects.toThrow(
        /pas suspendues/,
      );
    });

    it("une promesse échue (délai de grâce passé) est non tenue et les relances reprennent", async () => {
      const due = await sentReminder();
      const withinGrace = await sentReminder();
      for (const invoiceId of [due.invoiceId, withinGrace.invoiceId]) {
        await db.query("update invoices set status = 'promised' where id = $1", [invoiceId]);
      }
      await db.query(
        `insert into promises (organization_id, invoice_id, promised_date, source) values
           ($1, $2, ${PARIS_TODAY} - private.promise_grace_days() - 1, 'email_reply'),
           ($1, $3, ${PARIS_TODAY} - private.promise_grace_days(), 'email_reply')`,
        [tenant.organizationId, due.invoiceId, withinGrace.invoiceId],
      );

      await expect(
        asUser(db, tenant.userId, (tx) => tx.query("select public.settle_due_promises()")),
      ).rejects.toThrow(/permission denied/);
      const otherTenant = await asService(db, (tx) =>
        tx.query<{ settled: number }>("select public.settle_due_promises($1) as settled", [other.organizationId]),
      );
      expect(otherTenant.rows[0]?.settled).toBe(0);
      await asService(db, (tx) => tx.query("select public.settle_due_promises()"));

      expect(await invoiceState(due.invoiceId)).toEqual({ status: "late", paused: false });
      expect(await promisesOf(due.invoiceId)).toMatchObject([{ kept: false }]);
      expect(await auditActions(due.invoiceId)).toContain("promise.broken");
      expect(await invoiceState(withinGrace.invoiceId)).toMatchObject({ status: "promised" });
      expect(await promisesOf(withinGrace.invoiceId)).toMatchObject([{ kept: null }]);
    });

    it("au règlement, la promesse est tenue si le paiement arrive dans le délai de grâce", async () => {
      const onTime = await sentReminder();
      const tooLate = await sentReminder();
      await db.query(
        `insert into promises (organization_id, invoice_id, promised_date, source) values
           ($1, $2, ${PARIS_TODAY} - private.promise_grace_days(), 'manual'),
           ($1, $3, ${PARIS_TODAY} - private.promise_grace_days() - 1, 'manual')`,
        [tenant.organizationId, onTime.invoiceId, tooLate.invoiceId],
      );

      for (const invoiceId of [onTime.invoiceId, tooLate.invoiceId]) {
        await asUser(db, tenant.userId, (tx) =>
          tx.query(`select public.change_invoice_status($1, 'mark_paid', ${PARIS_TODAY})`, [invoiceId]),
        );
      }

      expect(await promisesOf(onTime.invoiceId)).toMatchObject([{ kept: true }]);
      expect(await promisesOf(tooLate.invoiceId)).toMatchObject([{ kept: false }]);
    });

    it("une facture réglée, contestée ou annulée classe les réponses en attente", async () => {
      const { invoiceId, reminderId } = await sentReminder();
      const replyId = await recordReply({ reminderId, kind: "paid_claim" });

      await asUser(db, tenant.userId, (tx) => tx.query(`select public.change_invoice_status($1, 'mark_paid', ${PARIS_TODAY})`, [invoiceId]));

      expect(await replyState(replyId)).toMatchObject({ status: "handled", handled_by: tenant.userId });
      expect(await invoiceState(invoiceId)).toEqual({ status: "paid", paused: false });
    });
  });

  it("l'export d'un débiteur (droit d'accès) comprend ses réponses", async () => {
    const debtor = await insertDebtor(db, tenant.organizationId, { siren: "732829320" });
    const { reminderId } = await sentReminder(tenant.organizationId, debtor);
    await recordReply({ reminderId, kind: "other", excerpt: "Pouvez-vous me renvoyer le RIB ?" });

    const { rows } = await asUser(db, tenant.userId, (tx) =>
      tx.query<{ document: { replies: Array<{ excerpt: string }> } }>("select public.export_debtor($1) as document", [debtor]),
    );

    expect(rows[0]?.document.replies).toEqual([expect.objectContaining({ excerpt: "Pouvez-vous me renvoyer le RIB ?", kind: "other" })]);
  });

  describe("boîte d'envoi : serveur IMAP", () => {
    const replaceMailbox = (provider: "smtp" | "gmail", imapHost: string | null) =>
      asService(db, (tx) =>
        tx.query<{ id: string }>(
          `select public.replace_email_account($1, $2, $3::public.email_provider, 'compta@atelier.example', 'Atelier',
             $4, $5, now() + interval '1 hour', $6, $7, $8, $9, $10, $11) as id`,
          provider === "smtp"
            ? [tenant.organizationId, tenant.userId, provider, null, null, "ssl0.ovh.net", 465, "compta@atelier.example", "secret", imapHost, 993]
            : [tenant.organizationId, tenant.userId, provider, "jeton", "rafraichissement", null, null, null, null, imapHost, 993],
        ),
      );

    const storedImap = async () => {
      const { rows } = await db.query<{ imap_host: string | null; imap_port: number | null }>(
        "select imap_host, imap_port from email_accounts where organization_id = $1",
        [tenant.organizationId],
      );
      return rows[0];
    };

    it("garde le serveur IMAP d'une boîte SMTP", async () => {
      await replaceMailbox("smtp", "ssl0.ovh.net");

      expect(await storedImap()).toEqual({ imap_host: "ssl0.ovh.net", imap_port: 993 });
    });

    it("l'ignore pour Gmail ou Outlook, lus par leur API", async () => {
      await replaceMailbox("gmail", "imap.gmail.com");

      expect(await storedImap()).toEqual({ imap_host: null, imap_port: null });
      await expect(
        db.query("update email_accounts set imap_host = 'imap.gmail.com', imap_port = 993 where organization_id = $1", [tenant.organizationId]),
      ).rejects.toThrow(/email_accounts_imap_for_smtp/);
    });
  });
});
