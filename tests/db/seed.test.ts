import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, asUser, createDatabase } from "./database";

/** Comptes de démonstration du jeu de données (supabase/seed.sql). */
const DEMO_USER_ID = "00000000-0000-4000-8000-00000000a001";

describe("jeu de données de démonstration", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDatabase({ withSeed: true });
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("crée deux organisations, pour pouvoir vérifier l'isolation à la main", async () => {
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from organizations");

    expect(rows[0]?.n).toBe(2);
  });

  it("couvre tous les statuts de facture", async () => {
    const { rows } = await db.query<{ status: string }>("select distinct status::text from invoices order by 1");

    expect(rows.map((row) => row.status)).toEqual(["cancelled", "disputed", "late", "paid", "pending", "promised"]);
  });

  it("couvre les trois profils de débiteur : personne morale, entreprise individuelle, particulier", async () => {
    const { rows } = await db.query<{ profile: string }>(
      `select distinct case
         when client_type = 'b2c' then 'particulier'
         when is_legal_entity then 'personne morale'
         else 'entreprise individuelle' end as profile
       from debtors order by 1`,
    );

    expect(rows.map((row) => row.profile)).toEqual(["entreprise individuelle", "particulier", "personne morale"]);
  });

  it("chaque organisation a un scénario par défaut B2B et un B2C", async () => {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from reminder_sequences where is_default group by organization_id",
    );

    expect(rows.map((row) => row.n)).toEqual([2, 2]);
  });

  it("contient une réponse à traiter, dont la facture a ses relances en pause", async () => {
    const { rows } = await db.query<{ kind: string; status: string; paused: boolean }>(
      `select reply.kind::text, reply.status::text, invoice.reminders_paused_at is not null as paused
       from replies as reply join invoices as invoice on invoice.id = reply.invoice_id`,
    );

    expect(rows).toEqual([{ kind: "paid_claim", status: "new", paused: true }]);
  });

  it("le compte de démonstration ne voit que sa propre organisation", async () => {
    const names = await asUser(db, DEMO_USER_ID, async (tx) =>
      (await tx.query<{ name: string }>("select name from organizations")).rows.map((row) => row.name),
    );

    expect(names).toEqual(["Atelier Démo"]);
  });
});
