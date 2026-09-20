import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, asUser, createDatabase } from "./database";
import { addMember, createTenant, insertDebtor, type Tenant } from "./fixtures";

/**
 * Facture datée par rapport à aujourd'hui (jours négatifs = passé). Insérée par le serveur :
 * les déclencheurs recalculent le comportement de paiement du débiteur.
 */
async function invoice(
  db: PGlite,
  tenant: Tenant,
  debtorId: string,
  number: string,
  { dueIn, paidIn }: { dueIn: number; paidIn?: number },
) {
  await db.query(
    `insert into public.invoices (organization_id, debtor_id, number, amount_ht, amount_ttc, issued_at, due_at, paid_at, status)
     values ($1, $2, $3, 1000, 1200, current_date + $4::int - 30, current_date + $4::int,
       current_date + $5::int, case when $5::int is null then 'pending' else 'paid' end::invoice_status)`,
    [tenant.organizationId, debtorId, number, dueIn, paidIn ?? null],
  );
}

const debtorStats = async (db: PGlite, debtorId: string) => {
  const { rows } = await db.query<{ risk_score: number | null; payment_behavior_days: number | null }>(
    "select risk_score, payment_behavior_days from debtors where id = $1",
    [debtorId],
  );
  return rows[0];
};

describe("score de risque de retard (§2.4)", () => {
  let db: PGlite;
  let tenant: Tenant;

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Score");
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("note une personne morale d'après son historique de règlement", async () => {
    const debtorId = await insertDebtor(db, tenant.organizationId, { siren: "123456782", isLegalEntity: true });
    // Retards de 30 et 0 jours : 40 × 15/60 + 30 × 1/2 = 25.
    await invoice(db, tenant, debtorId, "S-1", { dueIn: -100, paidIn: -70 });
    await invoice(db, tenant, debtorId, "S-2", { dueIn: -50, paidIn: -50 });

    expect(await debtorStats(db, debtorId)).toEqual({ risk_score: 25, payment_behavior_days: 15 });

    // Retard en cours de 45 jours : + 30 × 45/90 = 15.
    await invoice(db, tenant, debtorId, "S-3", { dueIn: -45 });
    expect((await debtorStats(db, debtorId))?.risk_score).toBe(40);
  });

  it("ne note jamais un particulier ni un entrepreneur individuel, même avec des retards", async () => {
    const individual = await insertDebtor(db, tenant.organizationId, { siren: "123456782", isLegalEntity: false });
    const consumer = await insertDebtor(db, tenant.organizationId, { clientType: "b2c", siren: null, isLegalEntity: false });
    await invoice(db, tenant, individual, "EI-1", { dueIn: -60, paidIn: -10 });
    await invoice(db, tenant, consumer, "P-1", { dueIn: -60, paidIn: -10 });

    expect(await debtorStats(db, individual)).toEqual({ risk_score: null, payment_behavior_days: 50 });
    expect(await debtorStats(db, consumer)).toEqual({ risk_score: null, payment_behavior_days: 50 });
  });

  it("retire le score dès que le débiteur n'est plus une personne morale identifiée, et le rétablit", async () => {
    const debtorId = await insertDebtor(db, tenant.organizationId, { siren: "123456782", isLegalEntity: true });
    await invoice(db, tenant, debtorId, "R-1", { dueIn: -90, paidIn: -30 });
    expect((await debtorStats(db, debtorId))?.risk_score).not.toBeNull();

    await asUser(db, tenant.userId, (tx) => tx.query("update debtors set client_type = 'b2c' where id = $1", [debtorId]));
    expect((await debtorStats(db, debtorId))?.risk_score).toBeNull();

    await asUser(db, tenant.userId, (tx) => tx.query("update debtors set client_type = 'b2b' where id = $1", [debtorId]));
    // Retard de 60 jours sur l'unique facture réglée : 40 + 30 = 70.
    expect((await debtorStats(db, debtorId))?.risk_score).toBe(70);
  });

  it("sans historique, pas de score", async () => {
    const debtorId = await insertDebtor(db, tenant.organizationId, { siren: "123456782", isLegalEntity: true });
    await invoice(db, tenant, debtorId, "N-1", { dueIn: 10 });

    expect(await debtorStats(db, debtorId)).toEqual({ risk_score: null, payment_behavior_days: null });
  });

  it("un membre ne peut pas écrire le score ni le comportement de paiement", async () => {
    const debtorId = await insertDebtor(db, tenant.organizationId);

    await expect(
      asUser(db, tenant.userId, (tx) => tx.query("update debtors set risk_score = 0 where id = $1", [debtorId])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, tenant.userId, (tx) =>
        tx.query(
          "insert into debtors (organization_id, name, client_type, risk_score) values ($1, 'Forgé', 'b2b', 1)",
          [tenant.organizationId],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("le changement de score n'encombre pas le journal", async () => {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from audit_logs where action = 'debtor.updated' and payload->'fields' ? 'risk_score'",
    );
    expect(rows[0]?.n).toBe(0);
  });
});

describe("liste, export et effacement des débiteurs", () => {
  let db: PGlite;
  let tenant: Tenant;
  let other: Tenant;
  let lateDebtor: string;
  let paidDebtor: string;

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Liste");
    other = await createTenant(db, "Autre Atelier");
    lateDebtor = await insertDebtor(db, tenant.organizationId, { siren: "123456782" });
    paidDebtor = await insertDebtor(db, tenant.organizationId, { clientType: "b2c", siren: null, isLegalEntity: false });
    await db.query("update debtors set name = 'Boulangerie Le Fournil', contact_email = 'contact@fournil.example' where id = $1", [
      paidDebtor,
    ]);
    await invoice(db, tenant, lateDebtor, "L-1", { dueIn: -20 });
    await invoice(db, tenant, lateDebtor, "L-2", { dueIn: 15 });
    await invoice(db, tenant, paidDebtor, "P-1", { dueIn: -20, paidIn: -25 });
    await db.query(
      "insert into reminders (organization_id, invoice_id, scheduled_at, status, subject) select organization_id, id, now(), 'scheduled', 'Rappel' from invoices where number = 'L-1'",
    );
    await insertDebtor(db, other.organizationId);
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("liste les débiteurs de l'organisation avec leur encours, les retards d'abord", async () => {
    const { rows } = await asUser(db, tenant.userId, (tx) =>
      tx.query<{ id: string; open_amount: string; late_amount: string; invoice_count: number; total_count: number }>(
        "select id, open_amount::text, late_amount::text, invoice_count, total_count from public.list_debtors()",
      ),
    );

    expect(rows).toEqual([
      { id: lateDebtor, open_amount: "2400.00", late_amount: "1200.00", invoice_count: 2, total_count: 2 },
      { id: paidDebtor, open_amount: "0", late_amount: "0", invoice_count: 1, total_count: 2 },
    ]);
  });

  it("filtre par type de client et recherche par nom, e-mail ou SIREN", async () => {
    const search = (clientType: string | null, text: string) =>
      asUser(db, tenant.userId, (tx) =>
        tx.query<{ id: string }>("select id from public.list_debtors($1, $2)", [clientType, text]),
      );

    expect((await search("b2c", "")).rows).toEqual([{ id: paidDebtor }]);
    expect((await search(null, "fournil")).rows).toEqual([{ id: paidDebtor }]);
    expect((await search(null, "1234")).rows).toEqual([{ id: lateDebtor }]);
  });

  it("exporte toutes les données d'un débiteur et trace l'export", async () => {
    const { rows } = await asUser(db, tenant.userId, (tx) =>
      tx.query<{ document: { debtor: { id: string }; invoices: unknown[]; reminders: Array<{ subject: string }> } }>(
        "select public.export_debtor($1) as document",
        [lateDebtor],
      ),
    );

    const document = rows[0]?.document;
    expect(document?.debtor.id).toBe(lateDebtor);
    expect(document?.invoices).toHaveLength(2);
    expect(document?.reminders.map((reminder) => reminder.subject)).toEqual(["Rappel"]);
    const audit = await db.query("select 1 from audit_logs where action = 'debtor.exported' and entity_id = $1", [lateDebtor]);
    expect(audit.rows).toHaveLength(1);
  });

  it("n'exporte pas le débiteur d'une autre organisation", async () => {
    await expect(
      asUser(db, other.userId, (tx) => tx.query("select public.export_debtor($1)", [lateDebtor])),
    ).rejects.toThrow(/introuvable/);
  });

  it("l'effacement est réservé aux responsables", async () => {
    const memberId = await addMember(db, tenant.organizationId, "member");

    await expect(
      asUser(db, memberId, (tx) => tx.query("select public.delete_debtor($1)", [lateDebtor])),
    ).rejects.toThrow(/non autorisée/);
  });

  it("efface le débiteur, ses factures et relances, et le trace sans donnée personnelle", async () => {
    const { rows } = await asUser(db, tenant.userId, (tx) =>
      tx.query<{ deleted: number }>("select public.delete_debtor($1) as deleted", [lateDebtor]),
    );

    expect(rows[0]?.deleted).toBe(2);
    const remaining = await db.query("select 1 from invoices where debtor_id = $1", [lateDebtor]);
    expect(remaining.rows).toHaveLength(0);
    const reminders = await db.query("select 1 from reminders");
    expect(reminders.rows).toHaveLength(0);
    const audit = await db.query<{ payload: unknown }>(
      "select payload from audit_logs where action = 'debtor.deleted' and entity_id = $1",
      [lateDebtor],
    );
    expect(audit.rows).toEqual([{ payload: { invoices_deleted: 2 } }]);
  });
});
