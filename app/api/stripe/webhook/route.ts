import type Stripe from "stripe";
import { getStripe, syncSubscription } from "@/lib/billing/stripe";

export const runtime = "nodejs";

/** Événements qui changent l'état d'un abonnement ; les autres sont acquittés sans effet. */
const SUBSCRIPTION_EVENTS: ReadonlySet<string> = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

function subscriptionToSync(event: Stripe.Event): { subscriptionId: string; organizationId: string | null } | null {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const subscription = session.subscription;
    const subscriptionId = typeof subscription === "string" ? subscription : (subscription?.id ?? null);
    return subscriptionId ? { subscriptionId, organizationId: session.client_reference_id } : null;
  }
  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    const object = event.data.object as { id?: unknown };
    return typeof object.id === "string" ? { subscriptionId: object.id, organizationId: null } : null;
  }
  return null;
}

/**
 * Webhook Stripe (abonnement à Relia seulement, §2.1). La signature est vérifiée sur le corps brut ;
 * l'abonnement est ensuite relu chez Stripe, donc un événement rejoué ou reçu dans le désordre est sans
 * danger. Une erreur renvoie 500 : Stripe réessaie.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("Abonnements non configurés", { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Signature manquante", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Signature invalide", { status: 400 });
  }

  const target = subscriptionToSync(event);
  if (!target) return Response.json({ received: true });
  try {
    const outcome = await syncSubscription(stripe, target.subscriptionId, target.organizationId);
    return Response.json({ received: true, outcome });
  } catch (error) {
    console.error("Webhook Stripe en échec", { type: event.type, message: error instanceof Error ? error.message : "inconnu" });
    return new Response("Traitement impossible", { status: 500 });
  }
}
