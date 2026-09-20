import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, asService, asUser, createDatabase } from "./database";
import { createTenant, type Tenant } from "./fixtures";

/** Invitations d'équipe (§7) : lien à jeton unique, jamais d'adresse dans le journal. */
describe("invitations d'équipe", () => {
  let db: PGlite;
  let tenant: Tenant;
  let other: Tenant;

  const invite = (userId: string, email: string, role = "member") =>
    asUser(db, userId, async (tx) =>
      (await tx.query<{ invitation_id: string; token: string }>(
        "select * from public.create_invitation($1, $2::public.member_role)",
        [email, role],
      )).rows[0],
    );

  /** Compte authentifié sans organisation : l'état d'un invité qui vient de s'inscrire. */
  const createOrphan = async (email: string) => {
    const { rows } = await db.query<{ id: string }>(
      "insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id",
      [email],
    );
    return rows[0]!.id;
  };

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Équipe");
    other = await createTenant(db, "Atelier Voisin");
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("le propriétaire invite, et le jeton n'est jamais lisible ensuite", async () => {
    const created = await invite(tenant.userId, "Nouvelle@Exemple.fr");

    expect(created?.token).toMatch(/^[0-9a-f]{64}$/);
    const stored = await db.query<{ email: string; token_hash: string }>(
      "select email, token_hash from invitations where id = $1",
      [created!.invitation_id],
    );
    expect(stored.rows[0]?.email).toBe("nouvelle@exemple.fr");
    expect(stored.rows[0]?.token_hash).not.toBe(created!.token);
  });

  it("le journal garde le rôle, jamais l'adresse invitée", async () => {
    const { rows } = await db.query<{ action: string; payload: Record<string, unknown> }>(
      "select action, payload from audit_logs where action = 'team.invited' order by created_at desc limit 1",
    );
    expect(rows[0]?.payload).toEqual({ role: "member" });
    expect(JSON.stringify(rows[0]?.payload)).not.toContain("exemple.fr");
  });

  it("un membre simple ne peut pas inviter", async () => {
    const memberId = await createOrphan("simple@exemple.fr");
    await asService(db, async (tx) => {
      await tx.query("insert into users (id, organization_id, email, role) values ($1, $2, $3, 'member')", [
        memberId,
        tenant.organizationId,
        "simple@exemple.fr",
      ]);
    });

    await expect(invite(memberId, "refuse@exemple.fr")).rejects.toThrow(/propriétaire et les administrateurs/);
  });

  it("refuse d'inviter quelqu'un qui est déjà de l'équipe", async () => {
    await expect(invite(tenant.userId, "simple@exemple.fr")).rejects.toThrow(/fait déjà partie/);
  });

  it("rejoint l'organisation avec le jeton, une seule fois", async () => {
    const created = await invite(tenant.userId, "arrivee@exemple.fr", "admin");
    const orphan = await createOrphan("arrivee@exemple.fr");

    const joined = await asUser(db, orphan, async (tx) =>
      (await tx.query<{ accept_invitation: string }>("select public.accept_invitation($1)", [created!.token])).rows[0],
    );
    expect(joined?.accept_invitation).toBe(tenant.organizationId);

    const membership = await db.query<{ role: string }>("select role from users where id = $1", [orphan]);
    expect(membership.rows[0]?.role).toBe("admin");

    // Le même jeton ne sert pas deux fois.
    const second = await createOrphan("arrivee@exemple.fr");
    await expect(
      asUser(db, second, async (tx) => tx.query("select public.accept_invitation($1)", [created!.token])),
    ).rejects.toThrow(/invalide ou expirée/);
  });

  it("refuse un jeton détenu par une autre adresse que celle invitée", async () => {
    const created = await invite(tenant.userId, "prevue@exemple.fr");
    const intruder = await createOrphan("intrus@exemple.fr");

    await expect(
      asUser(db, intruder, async (tx) => tx.query("select public.accept_invitation($1)", [created!.token])),
    ).rejects.toThrow(/autre adresse/);
  });

  it("refuse un jeton expiré, sans dire pourquoi", async () => {
    const created = await invite(tenant.userId, "tardive@exemple.fr");
    await db.query("update invitations set expires_at = now() - interval '1 day' where id = $1", [created!.invitation_id]);
    const orphan = await createOrphan("tardive@exemple.fr");

    await expect(
      asUser(db, orphan, async (tx) => tx.query("select public.accept_invitation($1)", [created!.token])),
    ).rejects.toThrow(/invalide ou expirée/);
  });

  it("une organisation ne voit pas les invitations d'une autre", async () => {
    const visible = await asUser(db, other.userId, async (tx) =>
      (await tx.query<{ n: number }>("select count(*)::int as n from invitations")).rows[0],
    );
    expect(visible?.n).toBe(0);
  });

  it("annule une invitation en cours, et pas celle d'une autre organisation", async () => {
    const created = await invite(tenant.userId, "annulee@exemple.fr");

    await asUser(db, tenant.userId, async (tx) => tx.query("select public.revoke_invitation($1)", [created!.invitation_id]));
    const left = await db.query<{ n: number }>("select count(*)::int as n from invitations where id = $1", [
      created!.invitation_id,
    ]);
    expect(left.rows[0]?.n).toBe(0);

    const foreign = await invite(tenant.userId, "etrangere@exemple.fr");
    await expect(
      asUser(db, other.userId, async (tx) => tx.query("select public.revoke_invitation($1)", [foreign!.invitation_id])),
    ).rejects.toThrow(/introuvable|administrateurs/);
  });
});
