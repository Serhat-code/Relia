import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, asAnon, asUser, createDatabase } from "./database";
import { createTenant, insertDebtor, type Tenant } from "./fixtures";

/** Tableau de bord (palier 12, §5.7) : synthèse calculée par la base, limitée à l'organisation du membre. */
describe("synthèse du tableau de bord", () => {
  let db: PGlite;
  let tenant: Tenant;
  let other: Tenant;

  type Summary = {
    open_amount: number;
    open_count: number;
    late_amount: number;
    late_count: number;
    promised_amount: number;
    promised_count: number;
    billed_90_days: number;
    aging: number[];
    at_risk: Array<{ number: string; debtor_name: string; risk_score: number | null }>;
  };

  const summaryFor = async (userId: string) =>
    asUser(db, userId, async (tx) => (await tx.query<{ summary: Summary }>("select public.dashboard_summary() as summary")).rows[0]?.summary);

  /** Facture émise il y a `issuedDaysAgo` jours, échue il y a `dueDaysAgo` jours (négatif : à venir). */
  const invoice = (organizationId: string, debtorId: string, number: string, amount: number, dueDaysAgo: number, status = "pending", currency = "EUR") =>
    db.query(
      `insert into invoices (organization_id, debtor_id, number, amount_ht, amount_ttc, currency, issued_at, due_at, status, paid_at)
       values ($1, $2, $3, $4, $4, $5, current_date - ($6::int + 30), current_date - $6::int, $7::public.invoice_status,
         case when $7 = 'paid' then current_date end)`,
      [organizationId, debtorId, number, amount, currency, dueDaysAgo, status],
    );

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Synthèse");
    other = await createTenant(db, "Autre Atelier");
    const debtor = await insertDebtor(db, tenant.organizationId);
    const otherDebtor = await insertDebtor(db, other.organizationId);

    await invoice(tenant.organizationId, debtor, "A-1", 1000, -10); // à échoir
    await invoice(tenant.organizationId, debtor, "A-2", 200, 10); // 10 jours de retard
    await invoice(tenant.organizationId, debtor, "A-3", 300, 45); // 45 jours
    await invoice(tenant.organizationId, debtor, "A-4", 400, 120); // 120 jours
    await invoice(tenant.organizationId, debtor, "A-5", 500, 5, "promised");
    await invoice(tenant.organizationId, debtor, "A-6", 600, 20, "paid");
    await invoice(tenant.organizationId, debtor, "A-7", 700, 20, "cancelled");
    await invoice(tenant.organizationId, debtor, "A-8", 800, 15, "pending", "USD");
    await invoice(other.organizationId, otherDebtor, "B-1", 9999, 30);
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("additionne l'encours, le retard et les promesses en euros, pour la seule organisation du membre", async () => {
    const summary = await summaryFor(tenant.userId);

    expect(summary).toMatchObject({
      open_amount: 2400,
      open_count: 5,
      late_amount: 900,
      late_count: 3,
      promised_amount: 500,
      promised_count: 1,
    });
  });

  it("répartit les retards par ancienneté", async () => {
    expect((await summaryFor(tenant.userId))?.aging).toEqual([200, 300, 0, 400]);
  });

  it("compte le facturé des 90 derniers jours, hors factures annulées, pour le DSO", async () => {
    // Émises il y a 20 à 150 jours : A-1 (1000), A-2 (200), A-3 (300), A-5 (500), A-6 (600) ; A-4 est trop ancienne.
    expect((await summaryFor(tenant.userId))?.billed_90_days).toBe(2600);
  });

  it("liste les retards les plus anciens d'abord, toutes devises", async () => {
    const summary = await summaryFor(tenant.userId);

    expect(summary?.at_risk.map((item) => item.number)).toEqual(["A-4", "A-3", "A-8", "A-2"]);
    expect(summary?.at_risk[0]).toMatchObject({ debtor_name: "Débiteur de test" });
  });

  it("le rôle anonyme ne peut pas l'appeler", async () => {
    await expect(asAnon(db, (tx) => tx.query("select public.dashboard_summary()"))).rejects.toThrow(/permission denied/);
  });
});
