import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasActiveAccess } from "@/lib/billing/access";
import { DB_TEST_TIMEOUT_MS, asService, asUser, createDatabase } from "./database";
import { createTenant, insertDebtor, insertInvoice, type Tenant } from "./fixtures";

/** Abonnement (palier 13, §5.9) : essai de 14 jours, accès, état Stripe écrit par le serveur seulement. */
describe("abonnement", () => {
  let db: PGlite;
  let tenant: Tenant;
  let counter = 0;

  const setBilling = (organizationId: string, status: string | null, trialSql: string) =>
    db.query(`update organizations set subscription_status = $2, trial_ends_at = ${trialSql} where id = $1`, [organizationId, status]);

  const accessInDatabase = async (organizationId: string) => {
    const { rows } = await db.query<{ access: boolean }>("select private.has_active_access($1) as access", [organizationId]);
    return rows[0]?.access;
  };

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Abonné");
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("une nouvelle organisation a 14 jours d'essai", async () => {
    const fresh = await createTenant(db, "Atelier Neuf");
    const { rows } = await db.query<{ days: number }>(
      "select round(extract(epoch from trial_ends_at - created_at) / 86400)::int as days from organizations where id = $1",
      [fresh.organizationId],
    );

    expect(rows[0]?.days).toBe(14);
  });

  it.each([
    [null, "now() + interval '3 days'"],
    [null, "now() - interval '1 day'"],
    ["active", "now() - interval '30 days'"],
    ["past_due", "now() - interval '30 days'"],
    ["canceled", "now() - interval '30 days'"],
    ["unpaid", "now() - interval '30 days'"],
    ["canceled", "now() + interval '2 days'"],
  ])("même règle d'accès en base et dans l'application : statut %s, essai jusqu'à %s", async (status, trialSql) => {
    await setBilling(tenant.organizationId, status, trialSql);
    const { rows } = await db.query<{ trial_ends_at: Date }>("select trial_ends_at from organizations where id = $1", [tenant.organizationId]);
    const trialEndsAt = rows[0]?.trial_ends_at.toISOString() ?? "";

    expect(await accessInDatabase(tenant.organizationId)).toBe(hasActiveAccess({ subscriptionStatus: status, trialEndsAt }));
  });

  it("sans accès, aucune relance due n'est réservée pour l'envoi", async () => {
    const debtor = await insertDebtor(db, tenant.organizationId, { siren: "732829320" });
    counter += 1;
    const invoice = await insertInvoice(db, tenant.organizationId, debtor, `ABO-${counter}`);
    const { rows } = await db.query<{ id: string }>(
      `insert into reminders (organization_id, invoice_id, scheduled_at, status, subject, body)
       values ($1, $2, now() - interval '1 minute', 'scheduled', 'Relance', 'Merci de régler.') returning id`,
      [tenant.organizationId, invoice],
    );
    const reminderId = rows[0]?.id;

    await setBilling(tenant.organizationId, "canceled", "now() - interval '30 days'");
    const blocked = await asService(db, (tx) => tx.query("select id from public.claim_reminder($1)", [reminderId]));
    await setBilling(tenant.organizationId, "active", "now() - interval '30 days'");
    const claimed = await asService(db, (tx) => tx.query<{ id: string }>("select id from public.claim_due_reminders(50)"));

    expect(blocked.rows).toHaveLength(0);
    expect(claimed.rows.map((row) => row.id)).toContain(reminderId);
  });

  describe("état Stripe", () => {
    const apply = (organizationId: string, customer: string, status: string, plan = "pro") =>
      asService(db, (tx) =>
        tx.query(
          "select public.apply_stripe_subscription($1, $2, $5, $3::public.plan_tier, $4, false, now() + interval '30 days')",
          [organizationId, customer, plan, status, `sub_${organizationId}`],
        ),
      );

    it("le serveur applique l'abonnement et le trace, une seule fois par changement", async () => {
      const subscriber = await createTenant(db, "Atelier Stripe");

      await apply(subscriber.organizationId, "cus_1", "active");
      await apply(subscriber.organizationId, "cus_1", "active");

      const { rows } = await db.query<{ plan: string; subscription_status: string; stripe_customer_id: string }>(
        "select plan::text, subscription_status, stripe_customer_id from organizations where id = $1",
        [subscriber.organizationId],
      );
      expect(rows[0]).toEqual({ plan: "pro", subscription_status: "active", stripe_customer_id: "cus_1" });
      const audit = await db.query("select 1 from audit_logs where action = 'subscription.updated' and organization_id = $1", [
        subscriber.organizationId,
      ]);
      expect(audit.rows).toHaveLength(1);
    });

    it("refuse un autre client Stripe, l'offre « essai » et un statut inconnu", async () => {
      const subscriber = await createTenant(db, "Atelier Prudent");
      await apply(subscriber.organizationId, "cus_a", "active");

      await expect(apply(subscriber.organizationId, "cus_b", "active")).rejects.toThrow(/Client Stripe différent/);
      await expect(apply(subscriber.organizationId, "cus_a", "active", "trial")).rejects.toThrow(/Offre invalide/);
      await expect(apply(subscriber.organizationId, "cus_a", "gratuit")).rejects.toThrow(/subscription_status/);
    });

    it("un membre ne peut ni appeler cette fonction, ni modifier son offre ou son essai", async () => {
      await expect(
        asUser(db, tenant.userId, (tx) =>
          tx.query("select public.apply_stripe_subscription($1, 'cus_x', 'sub_x', 'business', 'active', false, now())", [
            tenant.organizationId,
          ]),
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(db, tenant.userId, (tx) =>
          tx.query("update organizations set trial_ends_at = now() + interval '1 year' where id = $1", [tenant.organizationId]),
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });
});
