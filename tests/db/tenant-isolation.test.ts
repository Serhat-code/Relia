import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, asAnon, asUser, createDatabase } from "./database";
import { createTenant, insertDebtor, insertInvoice, type Tenant } from "./fixtures";

/** Un utilisateur n'accède qu'aux lignes de son organisation (CLAUDE.md §4). */
describe("isolation entre organisations", () => {
  let db: PGlite;
  let alpha: Tenant;
  let beta: Tenant;
  let betaDebtorId: string;
  let betaInvoiceId: string;

  beforeAll(async () => {
    db = await createDatabase();
    alpha = await createTenant(db, "Alpha");
    beta = await createTenant(db, "Beta");
    const alphaDebtorId = await insertDebtor(db, alpha.organizationId);
    await insertInvoice(db, alpha.organizationId, alphaDebtorId, "A-1");
    betaDebtorId = await insertDebtor(db, beta.organizationId);
    betaInvoiceId = await insertInvoice(db, beta.organizationId, betaDebtorId, "B-1");
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("ne voit que sa propre organisation, ses membres, ses débiteurs et ses factures", async () => {
    const visible = await asUser(db, alpha.userId, async (tx) => ({
      organizations: (await tx.query<{ name: string }>("select name from organizations")).rows,
      users: (await tx.query<{ id: string }>("select id from users")).rows,
      invoices: (await tx.query<{ number: string }>("select number from invoices")).rows,
      debtors: (await tx.query("select id from debtors")).rows.length,
    }));

    expect(visible).toEqual({
      organizations: [{ name: "Alpha" }],
      users: [{ id: alpha.userId }],
      invoices: [{ number: "A-1" }],
      debtors: 1,
    });
  });

  it("ne peut pas écrire dans une autre organisation", async () => {
    await expect(
      asUser(db, alpha.userId, (tx) =>
        tx.query("insert into debtors (organization_id, name, client_type) values ($1, 'Intrus', 'b2c')", [
          beta.organizationId,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("ne peut ni modifier ni supprimer les lignes d'une autre organisation", async () => {
    const affected = await asUser(db, alpha.userId, async (tx) => ({
      updated: (await tx.query("update debtors set name = 'PIRATE' where id = $1", [betaDebtorId])).affectedRows,
      deleted: (await tx.query("delete from debtors where id = $1", [betaDebtorId])).affectedRows,
    }));

    expect(affected).toEqual({ updated: 0, deleted: 0 });
  });

  it("ne peut pas changer le statut d'une facture d'une autre organisation", async () => {
    await expect(
      asUser(db, alpha.userId, (tx) =>
        tx.query("select public.change_invoice_status($1, 'cancel')", [betaInvoiceId]),
      ),
    ).rejects.toThrow(/introuvable/);
  });

  it("ne modifie ni ne supprime une facture directement, même la sienne", async () => {
    const { rows } = await db.query<{ id: string }>("select id from invoices where organization_id = $1 limit 1", [
      alpha.organizationId,
    ]);
    const ownInvoiceId = rows[0]?.id;

    await expect(
      asUser(db, alpha.userId, (tx) => tx.query("update invoices set amount_ttc = 1 where id = $1", [ownInvoiceId])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, alpha.userId, (tx) => tx.query("delete from invoices where id = $1", [ownInvoiceId])),
    ).rejects.toThrow(/permission denied/);
  });

  it("ne peut pas rattacher sa facture au débiteur d'une autre organisation", async () => {
    await expect(
      asUser(db, alpha.userId, (tx) =>
        tx.query(
          `insert into invoices (organization_id, debtor_id, number, amount_ht, amount_ttc, issued_at, due_at)
           values ($1, $2, 'A-2', 100, 120, '2026-09-01', '2026-09-30')`,
          [alpha.organizationId, betaDebtorId],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("un visiteur non connecté ne voit rien", async () => {
    await expect(asAnon(db, (tx) => tx.query("select id from invoices"))).rejects.toThrow(/permission denied/);
  });

  it("voit les modèles système et les siens, pas ceux des autres", async () => {
    await db.query(
      `insert into templates (organization_id, name, client_type, tone, subject, body_markdown, is_system) values
       (null, 'Système', 'b2b', 'courtois', 's', 'b', true),
       ($1, 'Alpha', 'b2b', 'courtois', 's', 'b', false),
       ($2, 'Beta', 'b2b', 'courtois', 's', 'b', false)`,
      [alpha.organizationId, beta.organizationId],
    );

    const names = await asUser(db, alpha.userId, async (tx) =>
      (
        await tx.query<{ name: string }>(
          "select name from templates where name in ('Alpha', 'Beta', 'Système') order by name",
        )
      ).rows.map((row) => row.name),
    );

    expect(names).toEqual(["Alpha", "Système"]);
  });

  it("ne peut ni créer ni modifier un modèle système", async () => {
    await expect(
      asUser(db, alpha.userId, (tx) =>
        tx.query(
          `insert into templates (organization_id, name, client_type, tone, subject, body_markdown, is_system)
           values (null, 'Faux système', 'b2b', 'ferme', 's', 'b', true)`,
        ),
      ),
    ).rejects.toThrow(/row-level security|permission denied/);

    const updated = await asUser(
      db,
      alpha.userId,
      async (tx) => (await tx.query("update templates set subject = 'x' where is_system")).affectedRows,
    );
    expect(updated).toBe(0);
  });
});
