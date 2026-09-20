/**
 * Accès au service (§5.9) : abonnement actif — un paiement en retard garde l'accès pendant que Stripe
 * relance la carte — ou essai en cours. Même règle que private.has_active_access (parité testée).
 * Sans accès, Relia ne prépare ni n'envoie de relances ; les données restent consultables.
 */

export const ACTIVE_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "past_due"]);

export type AccessState = { subscriptionStatus: string | null; trialEndsAt: string };

export function hasActiveAccess(state: AccessState, now: Date = new Date()): boolean {
  if (state.subscriptionStatus && ACTIVE_SUBSCRIPTION_STATUSES.has(state.subscriptionStatus)) return true;
  return Date.parse(state.trialEndsAt) > now.getTime();
}

const DAY_MS = 86_400_000;

export type BillingSituation =
  | { kind: "trial"; daysLeft: number }
  | { kind: "trial_ended" }
  | { kind: "subscribed"; status: "active" | "trialing" | "past_due"; renewsOn: string | null; endsOn: string | null }
  | { kind: "lapsed"; status: string };

type SituationInput = AccessState & { currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean };

/** Situation à afficher : jours d'essai restants, renouvellement, fin programmée, abonnement interrompu. */
export function describeBillingSituation(state: SituationInput, now: Date = new Date()): BillingSituation {
  const status = state.subscriptionStatus;
  if (status === "active" || status === "trialing" || status === "past_due") {
    return {
      kind: "subscribed",
      status,
      renewsOn: state.cancelAtPeriodEnd ? null : state.currentPeriodEnd,
      endsOn: state.cancelAtPeriodEnd ? state.currentPeriodEnd : null,
    };
  }
  if (status !== null) return hasActiveAccess(state, now) ? trialSituation(state, now) : { kind: "lapsed", status };
  return trialSituation(state, now);
}

function trialSituation(state: AccessState, now: Date): BillingSituation {
  const remaining = Date.parse(state.trialEndsAt) - now.getTime();
  return remaining > 0 ? { kind: "trial", daysLeft: Math.ceil(remaining / DAY_MS) } : { kind: "trial_ended" };
}
