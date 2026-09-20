import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, asService, asUser, createDatabase } from "./database";
import { createTenant, type Tenant } from "./fixtures";

describe("journal d'audit, privilèges et secrets", () => {
  let db: PGlite;
  let tenant: Tenant;

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Audit");
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  describe("journal d'audit immuable (§2.2)", () => {
    const insertLog = (actorType: string, actorId: string | null) =>
      asUser(db, tenant.userId, (tx) =>
        tx.query(
          `insert into audit_logs (organization_id, actor_type, actor_id, action, entity_type)
           values ($1, $2, $3, 'invoice.viewed', 'invoice')`,
          [tenant.organizationId, actorType, actorId],
        ),
      );

    it("un utilisateur trace ses propres actions", async () => {
      await expect(insertLog("user", tenant.userId)).resolves.toBeDefined();
    });

    it("un utilisateur ne peut pas se faire passer pour le système, l'IA ou un collègue", async () => {
      await expect(insertLog("system", null)).rejects.toThrow(/row-level security/);
      await expect(insertLog("ai", null)).rejects.toThrow(/row-level security/);
      await expect(insertLog("user", crypto.randomUUID())).rejects.toThrow(/row-level security/);
    });

    it("personne ne peut modifier ni supprimer une entrée, pas même le superutilisateur", async () => {
      await expect(db.query("update audit_logs set action = 'falsifié'")).rejects.toThrow(/immuable/);
      await expect(db.query("delete from audit_logs")).rejects.toThrow(/immuable/);
      await expect(db.query("truncate audit_logs")).rejects.toThrow(/immuable/);
    });

    it("seule la purge de conservation peut supprimer des entrées anciennes", async () => {
      await db.query(
        `insert into audit_logs (organization_id, actor_type, action, entity_type, created_at)
         values ($1, 'system', 'reminder.sent', 'reminder', now() - interval '5 years')`,
        [tenant.organizationId],
      );

      const { rows } = await db.query<{ purged: number }>(
        "select private.purge_audit_logs($1, now() - interval '3 years') as purged",
        [tenant.organizationId],
      );

      expect(rows[0]?.purged).toBe(1);
    });
  });

  describe("colonnes protégées", () => {
    it("un utilisateur modifie le nom de son organisation, pas son offre ni son DPA", async () => {
      await expect(
        asUser(db, tenant.userId, (tx) => tx.query("update organizations set name = 'Audit & Cie'")),
      ).resolves.toBeDefined();
      await expect(
        asUser(db, tenant.userId, (tx) => tx.query("update organizations set plan = 'business'")),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(db, tenant.userId, (tx) => tx.query("update organizations set dpa_accepted_at = now()")),
      ).rejects.toThrow(/permission denied/);
    });

    it("un utilisateur ne peut pas changer son propre rôle", async () => {
      await expect(asUser(db, tenant.userId, (tx) => tx.query("update users set role = 'owner'"))).rejects.toThrow(
        /permission denied/,
      );
    });

    it("les boîtes d'envoi et intégrations ne s'écrivent que côté serveur", async () => {
      await expect(
        asUser(db, tenant.userId, (tx) =>
          tx.query("insert into email_accounts (organization_id, provider, email_address) values ($1, 'gmail', 'a@b.fr')", [
            tenant.organizationId,
          ]),
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });

  describe("secrets chiffrés dans Vault (§8)", () => {
    it("le serveur stocke et relit un secret ; l'utilisateur ne peut ni l'un ni l'autre", async () => {
      const secretId = await asService(
        db,
        async (tx) =>
          (await tx.query<{ id: string }>("select public.vault_store_secret('jeton-oauth') as id")).rows[0]?.id,
      );
      expect(secretId).toBeDefined();

      const secret = await asService(
        db,
        async (tx) =>
          (await tx.query<{ value: string }>("select public.vault_read_secret($1) as value", [secretId])).rows[0]?.value,
      );
      expect(secret).toBe("jeton-oauth");

      await expect(
        asUser(db, tenant.userId, (tx) => tx.query("select public.vault_read_secret($1)", [secretId])),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(db, tenant.userId, (tx) => tx.query("select public.vault_store_secret('x')")),
      ).rejects.toThrow(/permission denied/);
    });

    it("supprimer une boîte d'envoi supprime ses secrets", async () => {
      const count = async () => (await db.query<{ n: number }>("select count(*)::int as n from vault.secrets")).rows[0]?.n;
      const before = await count();
      const accountId = await asService(db, async (tx) => {
        const access = (await tx.query<{ id: string }>("select public.vault_store_secret('a') as id")).rows[0]?.id;
        const refresh = (await tx.query<{ id: string }>("select public.vault_store_secret('r') as id")).rows[0]?.id;
        const inserted = await tx.query<{ id: string }>(
          `insert into email_accounts (organization_id, provider, email_address, oauth_access_token_secret_id, oauth_refresh_token_secret_id)
           values ($1, 'gmail', 'relances@audit.fr', $2, $3) returning id`,
          [tenant.organizationId, access, refresh],
        );
        return inserted.rows[0]?.id;
      });
      expect(await count()).toBe((before ?? 0) + 2);

      await asUser(db, tenant.userId, (tx) => tx.query("delete from email_accounts where id = $1", [accountId]));

      expect(await count()).toBe(before);
    });
  });
});
