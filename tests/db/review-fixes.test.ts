import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, asUser, createDatabase } from "./database";
import { addMember, createTenant, insertDebtor, insertInvoice, insertSequence, type Tenant } from "./fixtures";

describe("durcissements issus de la revue du schéma", () => {
  let db: PGlite;
  let tenant: Tenant;

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Revue");
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  describe("effacement d'une organisation (droit à l'effacement)", () => {
    it("une suppression directe reste bloquée par le journal d'audit immuable", async () => {
      const doomed = await createTenant(db, "À effacer");
      await db.query(
        "insert into audit_logs (organization_id, actor_type, action, entity_type) values ($1, 'system', 'x', 'y')",
        [doomed.organizationId],
      );

      await expect(db.query("delete from organizations where id = $1", [doomed.organizationId])).rejects.toThrow(
        /immuable/,
      );
    });

    it("private.delete_organization efface l'organisation et tout ce qui lui appartient", async () => {
      const doomed = await createTenant(db, "Effacée");
      const debtorId = await insertDebtor(db, doomed.organizationId);
      await insertInvoice(db, doomed.organizationId, debtorId);
      await db.query(
        "insert into audit_logs (organization_id, actor_type, action, entity_type) values ($1, 'system', 'x', 'y')",
        [doomed.organizationId],
      );

      await db.query("select private.delete_organization($1)", [doomed.organizationId]);

      const { rows } = await db.query<{ remaining: number }>(
        `select (select count(*) from organizations where id = $1)
              + (select count(*) from invoices where organization_id = $1)
              + (select count(*) from audit_logs where organization_id = $1) as remaining`,
        [doomed.organizationId],
      );
      expect(Number(rows[0]?.remaining)).toBe(0);
    });

    it("le verrou d'audit est rétabli après l'effacement", async () => {
      await expect(db.query("delete from audit_logs")).rejects.toThrow(/immuable/);
    });
  });

  describe("§2.3 — validation humaine signée en son propre nom", () => {
    let reminderId: string;
    let colleagueId: string;

    beforeAll(async () => {
      colleagueId = await addMember(db, tenant.organizationId);
      const debtorId = await insertDebtor(db, tenant.organizationId);
      const invoiceId = await insertInvoice(db, tenant.organizationId, debtorId, "APPROBATION-1");
      const { rows } = await db.query<{ id: string }>(
        `insert into reminders (organization_id, invoice_id, scheduled_at, status, ai_generated)
         values ($1, $2, now(), 'awaiting_approval', true) returning id`,
        [tenant.organizationId, invoiceId],
      );
      reminderId = rows[0]?.id ?? "";
    });

    it("refuse une approbation au nom d'un collègue", async () => {
      // Écriture directe impossible (palier 10) ; même le serveur ne peut signer au nom d'un autre membre connecté.
      await expect(
        asUser(db, tenant.userId, (tx) =>
          tx.query("update reminders set approved_by = $1 where id = $2", [colleagueId, reminderId]),
        ),
      ).rejects.toThrow(/permission denied/);
    });

    it("horodate l'approbation côté base quand l'utilisateur approuve lui-même", async () => {
      await asUser(db, tenant.userId, (tx) => tx.query("select public.approve_reminder($1)", [reminderId]));

      const { rows } = await db.query<{ approved_at: Date }>("select approved_at from reminders where id = $1", [
        reminderId,
      ]);
      expect(rows[0]?.approved_at.getFullYear()).toBeGreaterThan(2000);
    });
  });

  it("§2.5 — modifier un modèle déjà utilisé ne peut pas casser la cohérence B2B/B2C", async () => {
    const sequenceId = await insertSequence(db, tenant.organizationId, "b2c");
    const { rows } = await db.query<{ id: string }>(
      `insert into templates (organization_id, name, client_type, tone, subject, body_markdown)
       values ($1, 'Doux', 'b2c', 'courtois', 's', 'b') returning id`,
      [tenant.organizationId],
    );
    const templateId = rows[0]?.id;
    await db.query(
      `insert into reminder_steps (organization_id, sequence_id, position, offset_days, tone, template_id)
       values ($1, $2, 1, 10, 'courtois', $3)`,
      [tenant.organizationId, sequenceId, templateId],
    );

    await expect(db.query("update templates set client_type = 'b2b' where id = $1", [templateId])).rejects.toThrow(
      /utilisé/,
    );
    await expect(db.query("update templates set tone = 'ferme' where id = $1", [templateId])).rejects.toThrow(
      /utilisé/,
    );
  });

  it("un compte SMTP doit indiquer serveur, port et identifiant", async () => {
    await expect(
      db.query("insert into email_accounts (organization_id, provider, email_address) values ($1, 'smtp', 'x@y.fr')", [
        tenant.organizationId,
      ]),
    ).rejects.toThrow(/email_accounts_credentials_match_provider/);
  });

  it("chaque clé étrangère est couverte par un index (suppressions en cascade sans balayage complet)", async () => {
    const { rows } = await db.query<{ constraint_name: string }>(
      `select c.conname as constraint_name
       from pg_constraint c
       where c.contype = 'f' and c.connamespace = 'public'::regnamespace
         and not exists (
           select 1 from pg_index i
           where i.indrelid = c.conrelid and i.indpred is null
             and (string_to_array(i.indkey::text, ' ')::int2[])[1] = c.conkey[1]
         )
       order by 1`,
    );

    expect(rows).toEqual([]);
  });
});
