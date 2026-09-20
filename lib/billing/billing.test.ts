import { describe, expect, it } from "vitest";
import { describeBillingSituation, hasActiveAccess } from "./access";
import { isPaidPlan, PLANS } from "./plans";
import { planForPrice, readSubscription } from "./subscription";

const NOW = new Date("2026-09-21T10:00:00Z");
const PRICES = { starter: "price_essentiel", pro: "price_pro", business: "price_business" } as const;
const ORGANIZATION = "00000000-0000-4000-8000-0000000000a0";

describe("offres", () => {
  it("trois offres de 29 à 79 € par mois, une mise en avant", () => {
    expect(PLANS.map((plan) => plan.monthlyPrice)).toEqual([29, 49, 79]);
    expect(PLANS.filter((plan) => plan.isHighlighted)).toHaveLength(1);
    expect(isPaidPlan("pro")).toBe(true);
    expect(isPaidPlan("trial")).toBe(false);
  });
});

describe("hasActiveAccess", () => {
  it.each([
    ["essai en cours", null, "2026-09-25T00:00:00Z", true],
    ["essai terminé", null, "2026-09-20T00:00:00Z", false],
    ["abonnement actif", "active", "2026-09-01T00:00:00Z", true],
    ["paiement en retard (Stripe relance)", "past_due", "2026-09-01T00:00:00Z", true],
    ["abonnement résilié", "canceled", "2026-09-01T00:00:00Z", false],
    ["impayé", "unpaid", "2026-09-01T00:00:00Z", false],
  ])("%s", (_case, subscriptionStatus, trialEndsAt, expected) => {
    expect(hasActiveAccess({ subscriptionStatus, trialEndsAt }, NOW)).toBe(expected);
  });
});

describe("describeBillingSituation", () => {
  const base = { subscriptionStatus: null, trialEndsAt: "2026-09-25T09:00:00Z", currentPeriodEnd: null, cancelAtPeriodEnd: false };

  it("compte les jours d'essai restants, jour entamé compris", () => {
    expect(describeBillingSituation(base, NOW)).toEqual({ kind: "trial", daysLeft: 4 });
    expect(describeBillingSituation({ ...base, trialEndsAt: "2026-09-21T09:00:00Z" }, NOW)).toEqual({ kind: "trial_ended" });
  });

  it("distingue un renouvellement d'une fin programmée", () => {
    const subscribed = { ...base, subscriptionStatus: "active", currentPeriodEnd: "2026-10-21T10:00:00Z" };
    expect(describeBillingSituation(subscribed, NOW)).toMatchObject({ kind: "subscribed", renewsOn: "2026-10-21T10:00:00Z", endsOn: null });
    expect(describeBillingSituation({ ...subscribed, cancelAtPeriodEnd: true }, NOW)).toMatchObject({
      renewsOn: null,
      endsOn: "2026-10-21T10:00:00Z",
    });
  });

  it("un abonnement interrompu après l'essai coupe l'accès", () => {
    expect(describeBillingSituation({ ...base, subscriptionStatus: "canceled", trialEndsAt: "2026-09-01T00:00:00Z" }, NOW)).toEqual({
      kind: "lapsed",
      status: "canceled",
    });
  });
});

describe("readSubscription", () => {
  const subscription = {
    id: "sub_123",
    status: "active",
    customer: "cus_123",
    cancel_at_period_end: false,
    metadata: { organization_id: ORGANIZATION },
    items: { data: [{ price: { id: "price_pro" }, current_period_end: 1_792_000_000 }] },
  };

  it("déduit l'offre du prix et la fin de période de l'élément d'abonnement", () => {
    expect(readSubscription(subscription, PRICES)).toEqual({
      ok: true,
      update: {
        organizationId: ORGANIZATION,
        customerId: "cus_123",
        subscriptionId: "sub_123",
        plan: "pro",
        status: "active",
        currentPeriodEnd: new Date(1_792_000_000 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
      },
    });
  });

  it("accepte un client développé et ignore une organisation mal formée", () => {
    const reading = readSubscription({ ...subscription, customer: { id: "cus_9" }, metadata: { organization_id: "x" } }, PRICES);
    expect(reading).toMatchObject({ ok: true, update: { customerId: "cus_9", organizationId: null } });
  });

  it("refuse un prix qui n'est pas celui d'une offre, ou un objet inattendu", () => {
    expect(readSubscription({ ...subscription, items: { data: [{ price: { id: "price_autre" } }] } }, PRICES)).toEqual({
      ok: false,
      reason: "prix inconnu",
    });
    expect(readSubscription({ id: "sub_1" }, PRICES)).toEqual({ ok: false, reason: "abonnement illisible" });
    expect(planForPrice("price_business", PRICES)).toBe("business");
  });
});
