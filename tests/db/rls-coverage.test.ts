import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, createDatabase } from "./database";

/** Tables du schéma (CLAUDE.md §4). */
const SCHEMA_TABLES = [
  "audit_logs",
  "debtors",
  "email_accounts",
  "integrations",
  "invitations",
  "invoices",
  "organizations",
  "promises",
  "reminder_sequences",
  "reminder_steps",
  "reminders",
  "replies",
  "templates",
  "users",
];

describe("couverture RLS (CLAUDE.md §8)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDatabase();
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("crée toutes les tables du schéma", async () => {
    const { rows } = await db.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' order by tablename",
    );

    expect(rows.map((row) => row.tablename)).toEqual(SCHEMA_TABLES);
  });

  it("aucune table du schéma public n'est dépourvue de RLS", async () => {
    const { rows } = await db.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and not rowsecurity",
    );

    expect(rows).toEqual([]);
  });

  it("toutes les tables portent organization_id, obligatoire", async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `select t.tablename as table_name
       from pg_tables t
       where t.schemaname = 'public' and t.tablename <> 'organizations'
         and not exists (
           select 1 from information_schema.columns c
           where c.table_schema = 'public' and c.table_name = t.tablename
             and c.column_name = 'organization_id' and c.is_nullable = 'NO'
         )`,
    );

    // Seule exception : templates, dont organization_id est nul pour les modèles système.
    expect(rows.map((row) => row.table_name)).toEqual(["templates"]);
  });

  it("le rôle anonyme n'a aucun privilège sur les tables", async () => {
    const { rows } = await db.query<{ table_name: string; privilege_type: string }>(
      `select table_name, privilege_type from information_schema.role_table_grants
       where grantee = 'anon' and table_schema = 'public'`,
    );

    expect(rows).toEqual([]);
  });

  it("aucun rôle d'API ne peut vider une table (TRUNCATE contourne la RLS)", async () => {
    const { rows } = await db.query<{ grantee: string; table_name: string }>(
      `select grantee, table_name from information_schema.role_table_grants
       where table_schema = 'public' and privilege_type = 'TRUNCATE'
         and grantee in ('anon', 'authenticated')`,
    );

    expect(rows).toEqual([]);
  });
});
