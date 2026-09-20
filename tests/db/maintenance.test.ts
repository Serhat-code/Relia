import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, asService, asUser, createDatabase } from "./database";
import { createTenant, insertDebtor, insertInvoice } from "./fixtures";

/** Maintenance (palier 15) : purge au terme de la conservation, scores, effacement d'une organisation. */
describe("maintenance", () => {
  let db: PGlite;

  const count = async (sql: string, params: unknown[]) => {
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from ${sql}`, params);
    return rows[0]?.n ?? 0;
  };

  beforeAll(async () => {
    db = await createDatabase();
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("purge les factures closes depuis plus que la durée de conservation, et rien d'autre", async () => {
    const tenant = await createTenant(db, "Atelier Purge");
    await db.query("update organizations set retention_months = 12 where id = $1", [tenant.organizationId]);
    const oldDebtor = await insertDebtor(db, tenant.organizationId);
    const keptDebtor = await insertDebtor(db, tenant.organizationId, { siren: "732829320" });
    const expired = await insertInvoice(db, tenant.organizationId, oldDebtor, "P-ANCIENNE");
    const recentlyClosed = await insertInvoice(db, tenant.organizationId, keptDebtor, "P-RECENTE");
    const open = await insertInvoice(db, tenant.organizationId, keptDebtor, "P-OUVERTE");
    await db.query("update invoices set status = 'paid', paid_at = '2024-01-10' where id in ($1, $2)", [expired, recentlyClosed]);
    // closed_at est posé par la base et ne se modifie pas : on l'antidate hors déclencheurs.
    await db.query("set session_replication_role = replica");
    await db.query("update invoices set closed_at = now() - interval '13 months' where id = $1", [expired]);
    await db.query("set session_replication_role = origin");
    await db.query("update debtors set created_at = now() - interval '2 years' where id = $1", [oldDebtor]);
    await db.query(
      "insert into reminders (organization_id, invoice_id, scheduled_at, status, subject, body) values ($1, $2, now(), 'cancelled', 'R', 'Merci.')",
      [tenant.organizationId, expired],
    );

    await expect(asUser(db, tenant.userId, (tx) => tx.query("select public.purge_expired_data()"))).rejects.toThrow(/permission denied/);
    const { rows } = await asService(db, (tx) => tx.query<{ totals: { invoices: number; debtors: number } }>("select public.purge_expired_data() as totals"));

    expect(rows[0]?.totals).toMatchObject({ invoices: 1, debtors: 1 });
    expect(await count("invoices where id = any($1)", [[expired, recentlyClosed, open]])).toBe(2);
    expect(await count("reminders where invoice_id = $1", [expired])).toBe(0);
    expect(await count("debtors where id = any($1)", [[oldDebtor, keptDebtor]])).toBe(1);
    expect(await count("audit_logs where organization_id = $1 and action = 'data.purged'", [tenant.organizationId])).toBe(1);
  });

  it("purge aussi le journal plus ancien que la durée de conservation", async () => {
    const tenant = await createTenant(db, "Atelier Journal");
    await db.query("update organizations set retention_months = 12 where id = $1", [tenant.organizationId]);
    await db.query("set session_replication_role = replica");
    await db.query(
      "insert into audit_logs (organization_id, actor_type, action, entity_type, created_at) values ($1, 'system', 'ancien.evenement', 'organization', now() - interval '2 years')",
      [tenant.organizationId],
    );
    await db.query("set session_replication_role = origin");

    await asService(db, (tx) => tx.query("select public.purge_expired_data()"));

    expect(await count("audit_logs where organization_id = $1 and action = 'ancien.evenement'", [tenant.organizationId])).toBe(0);
    await expect(db.query("delete from audit_logs where organization_id = $1", [tenant.organizationId])).rejects.toThrow(/immuable/);
  });

  it("recalcule les scores de tous les débiteurs, jamais pour une personne physique", async () => {
    const tenant = await createTenant(db, "Atelier Scores");
    const company = await insertDebtor(db, tenant.organizationId, { siren: "552100554" });
    const person = await insertDebtor(db, tenant.organizationId, { clientType: "b2c", siren: null, isLegalEntity: false });
    await insertInvoice(db, tenant.organizationId, company, "S-1");
    await insertInvoice(db, tenant.organizationId, person, "S-2");
    await db.query("update debtors set risk_score = null where id = $1", [company]);

    const { rows } = await asService(db, (tx) => tx.query<{ n: number }>("select public.refresh_all_debtor_stats() as n"));

    expect(rows[0]?.n).toBeGreaterThanOrEqual(2);
    const scores = await db.query<{ id: string; risk_score: number | null }>("select id, risk_score from debtors where id = any($1)", [[company, person]]);
    expect(scores.rows.find((row) => row.id === company)?.risk_score).not.toBeNull();
    expect(scores.rows.find((row) => row.id === person)?.risk_score).toBeNull();
  });

  it("efface une organisation et tout ce qu'elle contient, journal compris, sans toucher aux autres", async () => {
    const leaving = await createTenant(db, "Atelier Sortant");
    const staying = await createTenant(db, "Atelier Restant");
    const debtor = await insertDebtor(db, leaving.organizationId);
    await insertInvoice(db, leaving.organizationId, debtor, "E-1");
    const stayingDebtor = await insertDebtor(db, staying.organizationId);

    const { rows } = await asService(db, (tx) => tx.query<{ ids: string[] }>("select public.erase_organization($1) as ids", [leaving.organizationId]));

    expect(rows[0]?.ids).toEqual([leaving.userId]);
    expect(await count("organizations where id = $1", [leaving.organizationId])).toBe(0);
    expect(await count("audit_logs where organization_id = $1", [leaving.organizationId])).toBe(0);
    expect(await count("debtors where id = $1", [stayingDebtor])).toBe(1);
    await expect(asService(db, (tx) => tx.query("select public.erase_organization($1)", [leaving.organizationId]))).rejects.toThrow(/introuvable/);
    await expect(asUser(db, staying.userId, (tx) => tx.query("select public.erase_organization($1)", [staying.organizationId]))).rejects.toThrow(
      /permission denied/,
    );
  });
});
