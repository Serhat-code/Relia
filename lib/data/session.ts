import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Enums } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentMember = {
  id: string;
  email: string;
  fullName: string | null;
  role: Enums<"member_role">;
  organization: {
    id: string;
    name: string;
    siren: string | null;
    plan: Enums<"plan_tier">;
    retentionMonths: number;
    billing: {
      trialEndsAt: string;
      subscriptionStatus: string | null;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
      hasStripeCustomer: boolean;
    };
  };
};

/**
 * anonymous : pas de session · orphan : compte créé mais organisation absente (inscription
 * interrompue) · member : membre rattaché à son organisation.
 */
export type SessionState =
  | { kind: "anonymous" }
  | { kind: "orphan"; userId: string; email: string | null }
  | { kind: "member"; member: CurrentMember };

/** Mémorisé pour la durée d'une requête : layout et page ne refont pas la lecture. */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return { kind: "anonymous" };

  const { data, error } = await supabase
    .from("users")
    .select(
      `id, email, full_name, role, organization:organizations (
        id, name, siren, plan, retention_months, trial_ends_at, subscription_status, current_period_end,
        cancel_at_period_end, stripe_customer_id
      )`,
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`Lecture du profil impossible : ${error.message}`);

  if (!data?.organization) {
    const email = auth.claims.email;
    return { kind: "orphan", userId, email: typeof email === "string" ? email : null };
  }

  return {
    kind: "member",
    member: {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      role: data.role,
      organization: {
        id: data.organization.id,
        name: data.organization.name,
        siren: data.organization.siren,
        plan: data.organization.plan,
        retentionMonths: data.organization.retention_months,
        billing: {
          trialEndsAt: data.organization.trial_ends_at,
          subscriptionStatus: data.organization.subscription_status,
          currentPeriodEnd: data.organization.current_period_end,
          cancelAtPeriodEnd: data.organization.cancel_at_period_end,
          hasStripeCustomer: data.organization.stripe_customer_id !== null,
        },
      },
    },
  };
});

/** Pour les pages de l'application : renvoie le membre connecté, ou redirige. */
export async function requireMember(): Promise<CurrentMember> {
  const state = await getSessionState();
  if (state.kind === "anonymous") redirect("/connexion");
  if (state.kind === "orphan") redirect("/inscription/finaliser");
  return state.member;
}
