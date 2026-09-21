import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, asService, asUser, createDatabase } from "./database";
import { createTenant, type Tenant } from "./fixtures";

/** Jeu d'essai (§1) : peupler un compte neuf sans qu'il puisse être confondu avec de vraies données. */
describe("jeu d'essai", () => {
  let db: PGlite;
  let tenant: Tenant;
  let other: Tenant;

  const load = (userId: string) =>
    asUser(db, userId, async (tx) => (await tx.query("select public.load_sample_data()")).rows[0]);
  const clear = (userId: string) =>
    asUser(db, userId, async (tx) =>
      (await tx.query<{ clear_sample_data: number }>("select public.clear_sample_data()")).rows[0]?.clear_sample_data,
    );

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Essai");
    other = await createTenant(db, "Atelier Voisin");
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("crée un client dont l'adresse est celle du membre : les relances lui reviennent", async () => {
    await load(tenant.userId);

    const { rows } = await db.query<{ contact_email: string; siren: string; is_sample: boolean }>(
      "select contact_email, siren, is_sample from debtors where organization_id = $1",
      [tenant.organizationId],
    );
    const account = await db.query<{ email: string }>("select email from auth.users where id = $1", [tenant.userId]);

    expect(rows[0]?.contact_email).toBe(account.rows[0]!.email.toLowerCase());
    expect(rows[0]?.is_sample).toBe(true);
    // Personne morale avec SIREN : le score de risque s'applique, la démonstration est complète.
    expect(rows[0]?.siren).toBe("732829320");
  });

  it("peuple le tableau de bord : à échoir, retards d'ancienneté variée, une réglée", async () => {
    const { rows } = await db.query<{ number: string; statut: string; jours: number }>(
      `select number, private.effective_invoice_status(status, due_at) as statut,
              (current_date - due_at)::int as jours
       from invoices where organization_id = $1 order by number`,
      [tenant.organizationId],
    );

    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.statut)).toEqual(["pending", "late", "late", "late", "paid"]);
    // Une facture par tranche d'ancienneté du graphique : 1-30, 31-60, > 90.
    expect(rows.filter((row) => row.statut === "late").map((row) => row.jours)).toEqual([12, 45, 95]);
  });

  it("emploie la devise de travail de l'organisation", async () => {
    await clear(tenant.userId);
    await db.query("update organizations set default_currency = 'RON' where id = $1", [tenant.organizationId]);
    await load(tenant.userId);

    const { rows } = await db.query<{ currency: string }>("select distinct currency from invoices where organization_id = $1", [
      tenant.organizationId,
    ]);
    expect(rows.map((row) => row.currency)).toEqual(["RON"]);
  });

  it("refuse un second chargement, qui fausserait les chiffres", async () => {
    await expect(load(tenant.userId)).rejects.toThrow(/déjà chargé/);
  });

  it("un membre simple ne peut ni charger ni effacer", async () => {
    const { rows } = await db.query<{ id: string }>(
      "insert into auth.users (id, email) values (gen_random_uuid(), 'simple@exemple.fr') returning id",
    );
    const memberId = rows[0]!.id;
    await asService(db, async (tx) => {
      await tx.query("insert into users (id, organization_id, email, role) values ($1, $2, 'simple@exemple.fr', 'member')", [
        memberId,
        other.organizationId,
      ]);
    });

    await expect(load(memberId)).rejects.toThrow(/propriétaire et les administrateurs/);
    await expect(clear(memberId)).rejects.toThrow(/propriétaire et les administrateurs/);
  });

  it("l'effacement ne touche que le jeu d'essai", async () => {
    const debtor = await asService(db, async (tx) =>
      (await tx.query<{ id: string }>(
        "insert into debtors (organization_id, name, client_type) values ($1, 'Vrai client', 'b2b') returning id",
        [tenant.organizationId],
      )).rows[0]!.id,
    );
    await asService(db, async (tx) => {
      await tx.query(
        `insert into invoices (organization_id, debtor_id, number, amount_ht, amount_ttc, currency, issued_at, due_at, status)
         values ($1, $2, 'VRAIE-1', 100, 100, 'RON', current_date - 10, current_date + 5, 'pending')`,
        [tenant.organizationId, debtor],
      );
    });

    const removed = await clear(tenant.userId);

    expect(removed).toBe(5);
    const left = await db.query<{ number: string }>("select number from invoices where organization_id = $1", [
      tenant.organizationId,
    ]);
    expect(left.rows.map((row) => row.number)).toEqual(["VRAIE-1"]);
    const debtors = await db.query<{ name: string }>("select name from debtors where organization_id = $1", [
      tenant.organizationId,
    ]);
    expect(debtors.rows.map((row) => row.name)).toEqual(["Vrai client"]);
  });
});
