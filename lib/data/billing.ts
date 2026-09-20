import "server-only";
import type Stripe from "stripe";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/billing/access";
import type { PaidPlan } from "@/lib/billing/plans";
import { getStripe, getStripePrices } from "@/lib/billing/stripe";
import type { CurrentMember } from "@/lib/data/session";
import { getPublicEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Parcours d'abonnement (Stripe Checkout et portail client). Réservé au propriétaire et aux
 * administrateurs, vérifiés par l'appelant. L'état de l'abonnement n'est jamais écrit ici : il
 * arrive par le webhook, relu chez Stripe.
 */

export type BillingRedirect = { ok: true; url: string } | { ok: false; error: string };

const UNAVAILABLE = "L'abonnement en ligne n'est pas encore disponible. Écrivez-nous pour activer votre offre.";

/** Client Stripe de l'organisation, créé une seule fois (clé d'idempotence liée à l'organisation). */
async function ensureCustomer(stripe: Stripe, member: CurrentMember): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("organizations").select("stripe_customer_id").eq("id", member.organization.id).single();
  if (error) throw new Error(`Lecture de l'organisation impossible : ${error.message}`);
  if (data.stripe_customer_id) return data.stripe_customer_id;

  const customer = await stripe.customers.create(
    { name: member.organization.name, email: member.email, metadata: { organization_id: member.organization.id } },
    { idempotencyKey: `relia-customer-${member.organization.id}` },
  );
  const { error: updateError } = await admin
    .from("organizations")
    .update({ stripe_customer_id: customer.id })
    .eq("id", member.organization.id)
    .is("stripe_customer_id", null);
  if (updateError) throw new Error(`Client Stripe non enregistré : ${updateError.message}`);
  return customer.id;
}

export async function createCheckoutUrl(member: CurrentMember, plan: PaidPlan): Promise<BillingRedirect> {
  const stripe = getStripe();
  const prices = getStripePrices();
  if (!stripe || !prices) return { ok: false, error: UNAVAILABLE };
  const status = member.organization.billing.subscriptionStatus;
  if (status && ACTIVE_SUBSCRIPTION_STATUSES.has(status)) {
    return { ok: false, error: "Votre abonnement est actif : changez d'offre depuis « Gérer mon abonnement »." };
  }

  const siteUrl = getPublicEnv().siteUrl;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: await ensureCustomer(stripe, member),
    client_reference_id: member.organization.id,
    line_items: [{ price: prices[plan], quantity: 1 }],
    subscription_data: { metadata: { organization_id: member.organization.id } },
    success_url: `${siteUrl}/app/parametres?abonnement=merci`,
    cancel_url: `${siteUrl}/app/parametres?abonnement=annule`,
    locale: "fr",
    allow_promotion_codes: true,
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "true" },
  });
  return session.url ? { ok: true, url: session.url } : { ok: false, error: UNAVAILABLE };
}

export async function createPortalUrl(member: CurrentMember): Promise<BillingRedirect> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: UNAVAILABLE };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("organizations").select("stripe_customer_id").eq("id", member.organization.id).single();
  if (error) throw new Error(`Lecture de l'organisation impossible : ${error.message}`);
  if (!data.stripe_customer_id) return { ok: false, error: "Aucun abonnement à gérer pour l'instant." };

  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${getPublicEnv().siteUrl}/app/parametres`,
    locale: "fr",
  });
  return { ok: true, url: session.url };
}
