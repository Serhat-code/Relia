import "server-only";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/billing/access";
import { getStripe } from "@/lib/billing/stripe";
import type { CurrentMember } from "@/lib/data/session";
import { confirmsOrganizationName } from "@/lib/organization/settings-form";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Effacement d'une organisation (droit à l'effacement, fin de contrat) : abonnement résilié chez Stripe
 * s'il court encore, toutes les données effacées (journal compris), puis les comptes des membres.
 * Irréversible. Réservé au propriétaire, qui confirme en saisissant le nom de l'organisation.
 */

export type ErasureResult = { ok: true } | { ok: false; error: string };

export async function eraseOrganization(member: CurrentMember, typedName: string): Promise<ErasureResult> {
  if (member.role !== "owner") return { ok: false, error: "Seul le propriétaire peut supprimer l'organisation." };
  if (!confirmsOrganizationName(typedName, member.organization.name)) {
    return { ok: false, error: "Le nom saisi ne correspond pas au nom de l'organisation." };
  }

  const admin = createSupabaseAdminClient();
  const { data: organization, error } = await admin
    .from("organizations")
    .select("stripe_subscription_id, subscription_status")
    .eq("id", member.organization.id)
    .single();
  if (error) throw new Error(`Lecture de l'organisation impossible : ${error.message}`);

  // Un abonnement en cours est résilié immédiatement : plus rien ne sera prélevé.
  const status = organization.subscription_status;
  if (organization.stripe_subscription_id && status && ACTIVE_SUBSCRIPTION_STATUSES.has(status)) {
    const stripe = getStripe();
    if (!stripe) return { ok: false, error: "Résiliez d'abord votre abonnement depuis « Gérer mon abonnement »." };
    await stripe.subscriptions.cancel(organization.stripe_subscription_id);
  }

  const { data: memberIds, error: eraseError } = await admin.rpc("erase_organization", { p_organization_id: member.organization.id });
  if (eraseError) throw new Error(`Effacement impossible : ${eraseError.message}`);

  for (const userId of memberIds) {
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    // Les données sont déjà effacées ; un compte restant ne donne plus accès à rien (pas d'organisation).
    if (authError) console.error("Compte d'authentification non supprimé", { userId, message: authError.message });
  }
  console.warn("Organisation effacée à la demande de son propriétaire", { organizationId: member.organization.id });
  return { ok: true };
}
