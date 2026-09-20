import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, asAnon, asService, asUser, createDatabase } from "./database";
import { createTenant, insertDebtor, insertInvoice, type Tenant } from "./fixtures";

type ImportResult = { created: number; invoice_ids: string[]; debtors_created: number; skipped: string[] };

const row = (overrides: Record<string, unknown> = {}) => ({
  number: "F-1",
  debtor_name: "Menuiserie Caradec",
  debtor_siren: "123456782",
  debtor_email: "compta@caradec.example",
  client_type: "b2b",
  amount_ht: 1000,
  amount_ttc: 1200,
  currency: "EUR",
  issued_at: "2026-01-05",
  due_at: "2026-02-04",
  paid_at: null,
  external_id: null,
  factur_x_raw: null,
  ...overrides,
});

async function importAs(tx: Transaction, rows: unknown[], source = "csv"): Promise<ImportResult> {
  const { rows: result } = await tx.query<{ result: ImportResult }>("select public.import_invoices($1, $2) as result", [
    JSON.stringify(rows),
    source,
  ]);
  const value = result[0]?.result;
  if (!value) throw new Error("import_invoices n'a rien renvoyé");
  return value;
}

describe("import de factures (palier 6)", () => {
  let db: PGlite;
  let tenant: Tenant;
  let other: Tenant;

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Import");
    other = await createTenant(db, "Autre Atelier");
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("crée factures et débiteurs, avec le statut déduit des dates", async () => {
    const result = await asUser(db, tenant.userId, (tx) =>
      importAs(tx, [
        row({ number: "IMP-1" }),
        row({ number: "IMP-2", paid_at: "2026-02-01" }),
        row({ number: "IMP-3", due_at: "2099-01-01" }),
      ]),
    );

    expect(result).toMatchObject({ created: 3, debtors_created: 1, skipped: [] });
    const { rows } = await db.query<{ number: string; status: string; source: string }>(
      "select number, status::text, source::text from invoices where number like 'IMP-%' order by number",
    );
    expect(rows).toEqual([
      { number: "IMP-1", status: "late", source: "csv" },
      { number: "IMP-2", status: "paid", source: "csv" },
      { number: "IMP-3", status: "pending", source: "csv" },
    ]);
  });

  it("rapproche un débiteur existant par SIREN, puis par nom sans tenir compte de la casse", async () => {
    await asUser(db, tenant.userId, (tx) =>
      importAs(tx, [
        row({ number: "MATCH-1", debtor_name: "Caradec (nom différent)" }),
        row({ number: "MATCH-2", debtor_name: "MENUISERIE CARADEC", debtor_siren: null }),
      ]),
    );

    const { rows } = await db.query<{ n: number }>(
      "select count(distinct debtor_id)::int as n from invoices where organization_id = $1",
      [tenant.organizationId],
    );
    expect(rows[0]?.n).toBe(1);
  });

  it("ne crée qu'un débiteur pour plusieurs factures d'un même nouveau client", async () => {
    const result = await asUser(db, tenant.userId, (tx) =>
      importAs(tx, [
        row({ number: "NEW-1", debtor_name: "Boulangerie Le Fournil", debtor_siren: null, client_type: "b2c" }),
        row({ number: "NEW-2", debtor_name: "boulangerie le fournil", debtor_siren: null, client_type: "b2c" }),
      ]),
    );

    expect(result).toMatchObject({ created: 2, debtors_created: 1 });
  });

  it("ignore les numéros déjà présents et les doublons du fichier", async () => {
    const result = await asUser(db, tenant.userId, (tx) =>
      importAs(tx, [row({ number: "IMP-1" }), row({ number: "DUP-1" }), row({ number: "DUP-1", amount_ttc: 9999 })]),
    );

    expect(result).toMatchObject({ created: 1, skipped: ["IMP-1", "DUP-1"] });
    const { rows } = await db.query<{ amount_ttc: string }>("select amount_ttc from invoices where number = 'DUP-1'");
    expect(rows).toEqual([{ amount_ttc: "1200.00" }]);
  });

  it("un numéro identique dans une autre organisation n'est pas un doublon", async () => {
    const result = await asUser(db, other.userId, (tx) => importAs(tx, [row({ number: "IMP-1" })]));

    expect(result).toMatchObject({ created: 1, skipped: [] });
  });

  it("annule tout l'import si une ligne est invalide", async () => {
    const attempt = asUser(db, tenant.userId, (tx) =>
      importAs(tx, [row({ number: "ATOMIC-1" }), row({ number: "ATOMIC-2", amount_ttc: 10, amount_ht: 100 })]),
    );

    await expect(attempt).rejects.toThrow(/invoices_ttc_covers_ht/);
    const { rows } = await db.query("select 1 from invoices where number like 'ATOMIC-%'");
    expect(rows).toHaveLength(0);
  });

  it("réserve les sources d'intégration au serveur et borne la taille d'un import", async () => {
    await expect(asUser(db, tenant.userId, (tx) => importAs(tx, [row({ number: "SRC-1" })], "pennylane"))).rejects.toThrow(
      /Source d'import non autorisée/,
    );
    await expect(asUser(db, tenant.userId, (tx) => importAs(tx, []))).rejects.toThrow(/entre 1 et 2000/);
    const tooMany = Array.from({ length: 2001 }, (_, index) => row({ number: `MANY-${index}` }));
    await expect(asUser(db, tenant.userId, (tx) => importAs(tx, tooMany))).rejects.toThrow(/entre 1 et 2000/);
  });

  it("est refusé au rôle anonyme", async () => {
    await expect(asAnon(db, (tx) => importAs(tx, [row({ number: "ANON-1" })]))).rejects.toThrow(/permission denied/);
  });

  it("trace chaque facture créée et l'import lui-même, au nom de l'utilisateur", async () => {
    const { rows } = await asUser(db, tenant.userId, (tx) =>
      tx.query<{ action: string; actor_type: string; actor_id: string; n: number }>(
        `select action, actor_type::text, actor_id, count(*)::int as n from audit_logs
         where action in ('invoice.created', 'invoices.imported', 'debtor.created')
         group by 1, 2, 3 order by 1`,
      ),
    );

    expect(rows).toEqual([
      { action: "debtor.created", actor_type: "user", actor_id: tenant.userId, n: 2 },
      { action: "invoice.created", actor_type: "user", actor_id: tenant.userId, n: 8 },
      { action: "invoices.imported", actor_type: "user", actor_id: tenant.userId, n: 4 },
    ]);
  });

  it("compte les factures par statut effectif, dans sa seule organisation", async () => {
    await db.query("update invoices set status = 'pending' where number = 'IMP-1'");

    const { rows } = await asUser(db, tenant.userId, (tx) =>
      tx.query<{ status: string; invoice_count: number }>(
        "select status::text, invoice_count from public.invoice_status_counts() order by 1",
      ),
    );

    // IMP-1 est « en attente » en base mais échue : elle compte comme en retard.
    expect(rows).toEqual([
      { status: "late", invoice_count: 6 },
      { status: "paid", invoice_count: 1 },
      { status: "pending", invoice_count: 1 },
    ]);
  });

  it("liste les factures filtrées par statut effectif, avec le total", async () => {
    const { rows } = await asUser(db, tenant.userId, (tx) =>
      tx.query<{ number: string; status: string; total_count: number }>(
        "select number, status::text, total_count from public.list_invoices(array['late']::invoice_status[], '', 'due_asc', 3, 0)",
      ),
    );

    expect(rows).toHaveLength(3);
    expect(rows.every((invoice) => invoice.status === "late" && invoice.total_count === 6)).toBe(true);
  });

  it("recherche dans le numéro et dans le nom du client", async () => {
    const search = (text: string) =>
      asUser(db, tenant.userId, (tx) =>
        tx.query<{ number: string }>("select number from public.list_invoices(null, $1, 'issued_desc') order by number", [text]),
      );

    expect((await search("dup-")).rows.map((invoice) => invoice.number)).toEqual(["DUP-1"]);
    expect((await search("fournil")).rows.map((invoice) => invoice.number)).toEqual(["NEW-1", "NEW-2"]);
  });

  it("n'expose jamais les factures d'une autre organisation", async () => {
    const { rows } = await asUser(db, other.userId, (tx) =>
      tx.query<{ number: string; debtor_name: string }>("select number, debtor_name from public.list_invoices()"),
    );

    expect(rows).toEqual([{ number: "IMP-1", debtor_name: "Menuiserie Caradec" }]);
  });

  it("une saisie manuelle n'ajoute pas d'entrée « import »", async () => {
    await asUser(db, tenant.userId, (tx) => importAs(tx, [row({ number: "MAN-1" })], "manual"));

    const { rows } = await db.query<{ payload: { source: string } }>(
      "select payload from audit_logs where action = 'invoices.imported' order by id desc limit 1",
    );
    expect(rows[0]?.payload.source).toBe("csv");
  });
});

describe("changements de statut d'une facture", () => {
  let db: PGlite;
  let tenant: Tenant;
  let invoiceId: string;

  const reminderStatuses = async () => {
    const { rows } = await db.query<{ status: string }>(
      "select status::text from reminders where invoice_id = $1 order by scheduled_at",
      [invoiceId],
    );
    return rows.map((reminder) => reminder.status);
  };

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Statuts");
    const debtorId = await insertDebtor(db, tenant.organizationId);
    invoiceId = await insertInvoice(db, tenant.organizationId, debtorId);
    await db.query(
      `insert into reminders (organization_id, invoice_id, scheduled_at, status, sent_at) values
         ($1, $2, '2026-08-28', 'sent', '2026-08-28'),
         ($1, $2, '2026-09-07', 'scheduled', null),
         ($1, $2, '2026-09-15', 'awaiting_approval', null)`,
      [tenant.organizationId, invoiceId],
    );
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("une facture réglée n'est plus relancée : les relances en attente sont annulées", async () => {
    await asUser(db, tenant.userId, (tx) =>
      tx.query("select public.change_invoice_status($1, 'mark_paid', '2026-09-18')", [invoiceId]),
    );

    expect(await reminderStatuses()).toEqual(["sent", "cancelled", "cancelled"]);
  });

  it("trace le changement de statut, avec le nombre de relances annulées", async () => {
    const { rows } = await db.query<{ actor_type: string; payload: Record<string, unknown> }>(
      "select actor_type::text, payload from audit_logs where action = 'invoice.status_changed' and entity_id = $1",
      [invoiceId],
    );

    expect(rows).toEqual([
      {
        actor_type: "user",
        payload: { from: "pending", to: "paid", paid_at: "2026-09-18", reminders_cancelled: 2 },
      },
    ]);
  });

  it("trace les modifications faites par le serveur au nom du système", async () => {
    await asService(db, (tx) => tx.query("update invoices set due_at = '2026-09-30' where id = $1", [invoiceId]));

    const { rows } = await db.query<{ actor_type: string; payload: Record<string, unknown> }>(
      "select actor_type::text, payload from audit_logs where action = 'invoice.updated' and entity_id = $1",
      [invoiceId],
    );
    expect(rows).toEqual([{ actor_type: "system", payload: { fields: ["due_at"] } }]);
  });

  it("une modification sans changement réel n'encombre pas le journal", async () => {
    const before = await db.query<{ n: number }>("select count(*)::int as n from audit_logs");

    await asService(db, (tx) => tx.query("update invoices set number = number where id = $1", [invoiceId]));

    const after = await db.query<{ n: number }>("select count(*)::int as n from audit_logs");
    expect(after.rows[0]?.n).toBe(before.rows[0]?.n);
  });
});

describe("rapprochement des débiteurs à l'import (revue du palier 6)", () => {
  let db: PGlite;
  let tenant: Tenant;

  const debtorsNamed = async (name: string) => {
    const { rows } = await db.query<{ id: string; siren: string | null; contact_email: string | null }>(
      "select id, siren, contact_email from debtors where lower(name) = lower($1) order by created_at",
      [name],
    );
    return rows;
  };

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Homonymes");
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("deux particuliers homonymes aux e-mails différents restent deux personnes", async () => {
    const homonym = { debtor_name: "Jean Dupont", debtor_siren: null, client_type: "b2c" };
    await asUser(db, tenant.userId, (tx) =>
      importAs(tx, [row({ ...homonym, number: "H-1", debtor_email: "jean.dupont@exemple.fr" })]),
    );
    await asUser(db, tenant.userId, (tx) =>
      importAs(tx, [
        row({ ...homonym, number: "H-2", debtor_email: "j.dupont@autre.example" }),
        row({ ...homonym, number: "H-3", debtor_email: "JEAN.DUPONT@exemple.fr" }),
      ]),
    );

    const debtors = await debtorsNamed("Jean Dupont");
    expect(debtors.map((debtor) => debtor.contact_email)).toEqual(["jean.dupont@exemple.fr", "j.dupont@autre.example"]);
    const { rows } = await db.query<{ number: string }>("select number from invoices where debtor_id = $1 order by number", [
      debtors[0]?.id,
    ]);
    expect(rows.map((invoice) => invoice.number)).toEqual(["H-1", "H-3"]);
  });

  it("un SIREN indiqué sur une ligne vaut pour les autres lignes du même client dans le fichier", async () => {
    const result = await asUser(db, tenant.userId, (tx) =>
      importAs(tx, [
        row({ number: "SI-1", debtor_name: "Studio Ancre", debtor_siren: "732829320", debtor_email: null }),
        row({ number: "SI-2", debtor_name: "studio ancre", debtor_siren: null, debtor_email: null }),
      ]),
    );

    expect(result).toMatchObject({ created: 2, debtors_created: 1 });
    expect(await debtorsNamed("Studio Ancre")).toEqual([
      expect.objectContaining({ siren: "732829320" }),
    ]);
  });

  it("met la devise en majuscules plutôt que d'échouer", async () => {
    await asUser(db, tenant.userId, (tx) => importAs(tx, [row({ number: "CUR-1", currency: "eur" })]));

    const { rows } = await db.query<{ currency: string }>("select currency from invoices where number = 'CUR-1'");
    expect(rows).toEqual([{ currency: "EUR" }]);
  });

  it("un « % » ou un « _ » tapé dans la recherche n'est pas un joker", async () => {
    const search = (text: string) =>
      asUser(db, tenant.userId, (tx) =>
        tx.query<{ number: string }>("select number from public.list_invoices(null, $1, 'issued_desc')", [text]),
      );

    expect((await search("%")).rows).toEqual([]);
    expect((await search("H_1")).rows).toEqual([]);
    expect((await search("H-1")).rows).toEqual([{ number: "H-1" }]);
  });
});
