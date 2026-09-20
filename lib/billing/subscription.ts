import { z } from "zod";
import type { PaidPlan } from "./plans";

/**
 * Traduction d'un abonnement Stripe en état Relia (pur, testé). L'abonnement est toujours relu chez
 * Stripe avant d'être appliqué : un événement ancien arrivé en retard ne peut pas écraser un état récent.
 */

export type PriceIds = Readonly<Record<PaidPlan, string>>;

/** Offre correspondant à un prix Stripe, ou null si le prix n'est pas celui d'une offre Relia. */
export function planForPrice(priceId: string, prices: PriceIds): PaidPlan | null {
  const entry = (Object.entries(prices) as Array<[PaidPlan, string]>).find(([, id]) => id === priceId);
  return entry?.[0] ?? null;
}

const subscriptionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["active", "trialing", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]),
  customer: z.union([z.string().min(1), z.object({ id: z.string().min(1) })]),
  cancel_at_period_end: z.boolean(),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
  items: z.object({
    data: z
      .array(z.object({ price: z.object({ id: z.string().min(1) }), current_period_end: z.number().int().optional() }))
      .min(1),
  }),
});

export type SubscriptionUpdate = {
  organizationId: string | null;
  customerId: string;
  subscriptionId: string;
  plan: PaidPlan;
  status: z.infer<typeof subscriptionSchema>["status"];
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type SubscriptionReading = { ok: true; update: SubscriptionUpdate } | { ok: false; reason: string };

const uuid = z.uuid();

export function readSubscription(raw: unknown, prices: PriceIds): SubscriptionReading {
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "abonnement illisible" };
  const subscription = parsed.data;
  const item = subscription.items.data[0];
  const plan = item ? planForPrice(item.price.id, prices) : null;
  if (!item || !plan) return { ok: false, reason: "prix inconnu" };
  const organizationId = subscription.metadata?.organization_id;

  return {
    ok: true,
    update: {
      organizationId: organizationId && uuid.safeParse(organizationId).success ? organizationId : null,
      customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      subscriptionId: subscription.id,
      plan,
      status: subscription.status,
      currentPeriodEnd: item.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  };
}
