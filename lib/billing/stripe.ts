import "server-only";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readSubscription, type PriceIds } from "./subscription";

/**
 * Stripe, pour l'abonnement à Relia uniquement (§2.1 : jamais pour encaisser les règlements des
 * clients). Sans configuration, l'abonnement est indisponible et l'essai suit son cours.
 */

export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  return secretKey ? new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 20_000, appInfo: { name: "Relia" } }) : null;
}

/** Prix Stripe des trois offres (variables STRIPE_PRICE_*), ou null si l'un manque. */
export function getStripePrices(): PriceIds | null {
  const starter = process.env.STRIPE_PRICE_STARTER;
  const pro = process.env.STRIPE_PRICE_PRO;
  const business = process.env.STRIPE_PRICE_BUSINESS;
  return starter && pro && business ? { starter, pro, business } : null;
}

export const isBillingConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY && getStripePrices());

export type SyncOutcome = "applied" | "ignored";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Relit l'abonnement chez Stripe et l'applique à son organisation : l'état appliqué est toujours le
 * plus récent, quel que soit l'ordre d'arrivée des événements. L'organisation vient des métadonnées
 * posées par Relia au paiement, sinon du client Stripe déjà rattaché.
 */
export async function syncSubscription(stripe: Stripe, subscriptionId: string, fallbackOrganizationId: string | null): Promise<SyncOutcome> {
  const prices = getStripePrices();
  if (!prices) throw new Error("Prix Stripe non configurés.");
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const reading = readSubscription(subscription, prices);
  if (!reading.ok) {
    console.error("Abonnement Stripe ignoré", { subscriptionId, reason: reading.reason });
    return "ignored";
  }
  const { update } = reading;
  const admin = createSupabaseAdminClient();

  let organizationId = update.organizationId ?? (fallbackOrganizationId && UUID.test(fallbackOrganizationId) ? fallbackOrganizationId : null);
  if (!organizationId) {
    const { data, error } = await admin.from("organizations").select("id").eq("stripe_customer_id", update.customerId).maybeSingle();
    if (error) throw new Error(`Organisation de l'abonnement introuvable : ${error.message}`);
    organizationId = data?.id ?? null;
  }
  if (!organizationId) {
    console.error("Abonnement Stripe sans organisation", { subscriptionId });
    return "ignored";
  }

  const { error } = await admin.rpc("apply_stripe_subscription", {
    p_organization_id: organizationId,
    p_customer_id: update.customerId,
    p_subscription_id: update.subscriptionId,
    p_plan: update.plan,
    p_status: update.status,
    p_cancel_at_period_end: update.cancelAtPeriodEnd,
    ...(update.currentPeriodEnd ? { p_current_period_end: update.currentPeriodEnd } : {}),
  });
  if (error) throw new Error(`Abonnement non appliqué : ${error.message}`);
  return "applied";
}
