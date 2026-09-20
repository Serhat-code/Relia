import type { PGlite, Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, asService, asUser, createDatabase } from "./database";
import { createTenant, type Tenant } from "./fixtures";

/** Boîte d'envoi du client (palier 9) : secrets dans Vault, fonctions réservées au serveur. */
describe("boîte d'envoi", () => {
  let db: PGlite;
  let tenant: Tenant;
  let other: Tenant;

  const connectGmail = (tx: Transaction, organizationId: string, actorId: string, email = "compta@atelier.example") =>
    tx.query<{ id: string }>(
      `select public.replace_email_account($1, $2, 'gmail', $3, 'Atelier', 'acces-1', 'rafraichissement-1',
         now() + interval '1 hour') as id`,
      [organizationId, actorId, email],
    );

  const credentials = (organizationId: string) =>
    asService(db, async (tx) => {
      const { rows } = await tx.query<Record<string, string | null>>(
        "select provider::text, email_address, access_token, refresh_token, smtp_password from public.email_account_credentials($1)",
        [organizationId],
      );
      return rows;
    });

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Boîte");
    other = await createTenant(db, "Autre Atelier");
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("enregistre une boîte OAuth avec ses jetons chiffrés dans Vault, et trace la connexion", async () => {
    await asService(db, (tx) => connectGmail(tx, tenant.organizationId, tenant.userId, "Compta@Atelier.example"));

    expect(await credentials(tenant.organizationId)).toEqual([
      {
        provider: "gmail",
        email_address: "compta@atelier.example",
        access_token: "acces-1",
        refresh_token: "rafraichissement-1",
        smtp_password: null,
      },
    ]);
    const { rows } = await db.query("select 1 from audit_logs where action = 'mailbox.connected'");
    expect(rows).toHaveLength(1);
  });

  it("une nouvelle connexion remplace l'ancienne et efface ses secrets", async () => {
    const before = await db.query<{ n: number }>("select count(*)::int as n from vault.secrets");

    await asService(db, (tx) =>
      tx.query(
        `select public.replace_email_account($1, $2, 'smtp', 'factures@atelier.example', 'Atelier',
           p_smtp_host => 'ssl0.ovh.net', p_smtp_port => 465, p_smtp_user => 'factures@atelier.example',
           p_smtp_password => 'mot-de-passe')`,
        [tenant.organizationId, tenant.userId],
      ),
    );

    const accounts = await db.query("select 1 from email_accounts where organization_id = $1", [tenant.organizationId]);
    expect(accounts.rows).toHaveLength(1);
    const after = await db.query<{ n: number }>("select count(*)::int as n from vault.secrets");
    expect(after.rows[0]?.n).toBe((before.rows[0]?.n ?? 0) - 1);
    expect((await credentials(tenant.organizationId))[0]).toMatchObject({ provider: "smtp", smtp_password: "mot-de-passe" });
  });

  it("renouvelle le jeton d'accès (et le jeton de rafraîchissement qui tourne)", async () => {
    await asService(db, (tx) => connectGmail(tx, other.organizationId, other.userId, "contact@autre.example"));
    const { rows } = await db.query<{ id: string }>("select id from email_accounts where organization_id = $1", [
      other.organizationId,
    ]);

    await asService(db, (tx) =>
      tx.query(
        "select public.store_email_account_tokens($1, $2, 'acces-2', now() + interval '1 hour', 'rafraichissement-2')",
        [other.organizationId, rows[0]?.id],
      ),
    );
    await expect(
      asService(db, (tx) =>
        tx.query("select public.store_email_account_tokens($1, $2, 'x', now())", [tenant.organizationId, rows[0]?.id]),
      ),
    ).rejects.toThrow(/introuvable/);

    expect((await credentials(other.organizationId))[0]).toMatchObject({
      access_token: "acces-2",
      refresh_token: "rafraichissement-2",
    });
  });

  it("un membre ne peut ni appeler ces fonctions ni lire les secrets", async () => {
    await expect(
      asUser(db, tenant.userId, (tx) => connectGmail(tx, tenant.organizationId, tenant.userId)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, tenant.userId, (tx) => tx.query("select * from public.email_account_credentials($1)", [tenant.organizationId])),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(db, tenant.userId, (tx) => tx.query("select * from vault.decrypted_secrets"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("un membre voit la boîte de son organisation, sans les identifiants des secrets déchiffrés", async () => {
    const { rows } = await asUser(db, tenant.userId, (tx) =>
      tx.query<{ email_address: string }>("select email_address from email_accounts"),
    );

    expect(rows).toEqual([{ email_address: "factures@atelier.example" }]);
  });

  it("refuse une boîte OAuth sans jetons", async () => {
    await expect(
      asService(db, (tx) =>
        tx.query("select public.replace_email_account($1, $2, 'outlook', 'a@b.example', 'A')", [
          tenant.organizationId,
          tenant.userId,
        ]),
      ),
    ).rejects.toThrow(/Jetons OAuth manquants/);
  });
});
