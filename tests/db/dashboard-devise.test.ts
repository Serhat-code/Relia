import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, asUser, createDatabase } from "./database";
import { createTenant, insertDebtor, type Tenant } from "./fixtures";

/**
 * Devise de travail de l'organisation : la synthèse ne porte que sur elle, sans jamais convertir.
 * Sans ce réglage, une organisation hors zone euro voyait tous ses indicateurs à zéro.
 */
describe("synthèse et devise de travail", () => {
  let db: PGlite;
  let tenant: Tenant;

  type Summary = { currency: string; open_amount: number; open_count: number; other_currency_count: number; billed_90_days: number };

  const summaryFor = async (userId: string) =>
    asUser(db, userId, async (tx) => (await tx.query<{ summary: Summary }>("select public.dashboard_summary() as summary")).rows[0]?.summary);

  const invoice = (organizationId: string, debtorId: string, number: string, amount: number, currency: string) =>
    db.query(
      `insert into invoices (organization_id, debtor_id, number, amount_ht, amount_ttc, currency, issued_at, due_at, status)
       values ($1, $2, $3, $4, $4, $5, current_date - 40, current_date - 10, 'pending')`,
      [organizationId, debtorId, number, amount, currency],
    );

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Bucarest");
    const debtor = await insertDebtor(db, tenant.organizationId);
    await invoice(tenant.organizationId, debtor, "R-1", 1500, "RON");
    await invoice(tenant.organizationId, debtor, "R-2", 2500, "RON");
    await invoice(tenant.organizationId, debtor, "E-1", 900, "EUR");
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("s'en tient à l'euro par défaut", async () => {
    const summary = await summaryFor(tenant.userId);

    expect(summary?.currency).toBe("EUR");
    expect(summary?.open_amount).toBe(900);
    expect(summary?.other_currency_count).toBe(2);
  });

  it("bascule sur la devise déclarée, sans jamais additionner les deux", async () => {
    await db.query("update organizations set default_currency = 'RON' where id = $1", [tenant.organizationId]);

    const summary = await summaryFor(tenant.userId);

    expect(summary?.currency).toBe("RON");
    // 1500 + 2500, et surtout pas les 900 € : convertir serait inventer un taux.
    expect(summary?.open_amount).toBe(4000);
    expect(summary?.open_count).toBe(2);
    expect(summary?.other_currency_count).toBe(1);
    expect(summary?.billed_90_days).toBe(4000);
  });

  it("refuse une devise qui n'est pas un code ISO à trois lettres", async () => {
    await expect(
      db.query("update organizations set default_currency = 'euro' where id = $1", [tenant.organizationId]),
    ).rejects.toThrow(/organizations_default_currency_check/);
  });
});

/** L'encours par client était figé à l'euro lui aussi : nul pour une organisation hors zone euro. */
describe("liste des débiteurs et devise de travail", () => {
  let db: PGlite;
  let tenant: Tenant;

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Prague");
    const debtor = await insertDebtor(db, tenant.organizationId);
    await db.query(
      `insert into invoices (organization_id, debtor_id, number, amount_ht, amount_ttc, currency, issued_at, due_at, status)
       values ($1, $2, 'C-1', 8000, 8000, 'CZK', current_date - 40, current_date - 10, 'pending'),
              ($1, $2, 'C-2', 300, 300, 'EUR', current_date - 40, current_date - 10, 'pending')`,
      [tenant.organizationId, debtor],
    );
    await db.query("update organizations set default_currency = 'CZK' where id = $1", [tenant.organizationId]);
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("compte l'encours dans la devise de travail, pas en euros", async () => {
    const rows = await asUser(db, tenant.userId, async (tx) =>
      (await tx.query<{ open_amount: string; late_amount: string }>("select * from public.list_debtors()")).rows,
    );

    expect(Number(rows[0]?.open_amount)).toBe(8000);
    expect(Number(rows[0]?.late_amount)).toBe(8000);
  });
});

/**
 * Les deux revues ont relevé l'absence de ce contrôle : la RLS interdit à un membre simple de
 * toucher aux réglages, mais rien ne le vérifiait. Le privilège de colonne sur `default_currency`
 * n'ouvre rien — la politique d'UPDATE rejette la ligne avant même la colonne.
 */
describe("réglages d'organisation réservés aux responsables", () => {
  let db: PGlite;
  let tenant: Tenant;
  let memberId: string;

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Rôles");
    const { rows } = await db.query<{ id: string }>(
      "insert into auth.users (id, email) values (gen_random_uuid(), 'membre@exemple.fr') returning id",
    );
    memberId = rows[0]!.id;
    await db.query("insert into users (id, organization_id, email, role) values ($1, $2, 'membre@exemple.fr', 'member')", [
      memberId,
      tenant.organizationId,
    ]);
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("un membre simple ne change ni la devise, ni le nom, ni la conservation", async () => {
    for (const [column, value] of [
      ["default_currency", "'RSD'"],
      ["name", "'Renommé de force'"],
      ["retention_months", "12"],
    ] as const) {
      const affected = await asUser(db, memberId, async (tx) =>
        (await tx.query(`update organizations set ${column} = ${value} where id = $1`, [tenant.organizationId])).affectedRows,
      );
      expect(affected, column).toBe(0);
    }
  });

  it("le propriétaire, lui, y parvient", async () => {
    const affected = await asUser(db, tenant.userId, async (tx) =>
      (await tx.query("update organizations set default_currency = 'RSD' where id = $1", [tenant.organizationId])).affectedRows,
    );
    expect(affected).toBe(1);
  });
});
