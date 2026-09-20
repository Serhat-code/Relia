import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const syncSubscription = vi.fn(async () => "applied" as const);

vi.mock("@/lib/billing/stripe", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/billing/stripe")>();
  return { ...original, syncSubscription: (...args: unknown[]) => syncSubscription(...(args as [])) };
});

const { POST } = await import("./route");

const SECRET = "whsec_test_relia";
const ORGANIZATION = "00000000-0000-4000-8000-0000000000a0";
const signer = new Stripe("sk_test_relia");

function webhookRequest(event: object, { secret = SECRET, signature }: { secret?: string; signature?: string | null } = {}) {
  const payload = JSON.stringify(event);
  const header = signature === undefined ? signer.webhooks.generateTestHeaderString({ payload, secret }) : signature;
  return new Request("https://relia.example/api/stripe/webhook", {
    method: "POST",
    body: payload,
    headers: header === null ? {} : { "stripe-signature": header },
  });
}

const checkoutCompleted = {
  id: "evt_1",
  object: "event",
  type: "checkout.session.completed",
  data: { object: { id: "cs_1", object: "checkout.session", subscription: "sub_1", client_reference_id: ORGANIZATION } },
};

describe("webhook Stripe", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_relia");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
    syncSubscription.mockClear();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("sans configuration, répond 503", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

    expect((await POST(webhookRequest(checkoutCompleted))).status).toBe(503);
  });

  it("refuse une requête sans signature ou mal signée", async () => {
    expect((await POST(webhookRequest(checkoutCompleted, { signature: null }))).status).toBe(400);
    expect((await POST(webhookRequest(checkoutCompleted, { secret: "whsec_autre" }))).status).toBe(400);
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it("après un paiement, relit l'abonnement pour l'organisation indiquée au départ", async () => {
    const response = await POST(webhookRequest(checkoutCompleted));

    expect(response.status).toBe(200);
    expect(syncSubscription).toHaveBeenCalledWith(expect.anything(), "sub_1", ORGANIZATION);
  });

  it("suit les changements d'abonnement", async () => {
    await POST(webhookRequest({ ...checkoutCompleted, type: "customer.subscription.deleted", data: { object: { id: "sub_9" } } }));

    expect(syncSubscription).toHaveBeenCalledWith(expect.anything(), "sub_9", null);
  });

  it("acquitte sans rien faire un événement sans rapport", async () => {
    const response = await POST(webhookRequest({ ...checkoutCompleted, type: "invoice.created", data: { object: { id: "in_1" } } }));

    expect(response.status).toBe(200);
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it("répond 500 si l'abonnement n'a pas pu être appliqué, pour que Stripe réessaie", async () => {
    syncSubscription.mockRejectedValueOnce(new Error("base indisponible"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect((await POST(webhookRequest(checkoutCompleted))).status).toBe(500);
  });
});
