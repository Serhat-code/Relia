"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isPaidPlan } from "@/lib/billing/plans";
import { createCheckoutUrl, createPortalUrl, type BillingRedirect } from "@/lib/data/billing";
import { eraseOrganization } from "@/lib/data/organization-erasure";
import { updateOrganizationSettings, updateRetentionMonths } from "@/lib/data/organization-settings";
import { requireMember } from "@/lib/data/session";
import { readForm, type FormState } from "@/lib/forms/form-state";
import { ORGANIZATION_FORM_FIELDS, parseOrganizationForm, parseRetention } from "@/lib/organization/settings-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Paramètres (§7). Réglages et abonnement réservés au propriétaire et aux administrateurs. */

const ROLE_ERROR = "Seuls le propriétaire et les administrateurs peuvent modifier ces réglages.";
const BILLING_ERROR = "Le service de paiement ne répond pas. Réessayez dans un instant.";

async function responsibleMember() {
  const member = await requireMember();
  return member.role === "member" ? null : member;
}

/** Redirige vers Stripe (paiement ou portail), ou renvoie le motif de l'échec au formulaire. */
async function goToStripe(run: () => Promise<BillingRedirect>): Promise<FormState> {
  let target: BillingRedirect;
  try {
    target = await run();
  } catch (error) {
    console.error("Stripe injoignable", { message: error instanceof Error ? error.message : "inconnu" });
    return { status: "error", message: BILLING_ERROR };
  }
  if (!target.ok) return { status: "error", message: target.error };
  redirect(target.url);
}

export async function startCheckoutAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await responsibleMember();
  if (!member) return { status: "error", message: ROLE_ERROR };
  const plan = String(formData.get("plan") ?? "");
  if (!isPaidPlan(plan)) return { status: "error", message: "Offre inconnue." };
  return goToStripe(() => createCheckoutUrl(member, plan));
}

export async function openBillingPortalAction(): Promise<FormState> {
  const member = await responsibleMember();
  if (!member) return { status: "error", message: ROLE_ERROR };
  return goToStripe(() => createPortalUrl(member));
}

export async function updateOrganizationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await responsibleMember();
  if (!member) return { status: "error", message: ROLE_ERROR };
  const values = readForm(formData, ORGANIZATION_FORM_FIELDS);
  const parsed = parseOrganizationForm(values);
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors, values };

  const result = await updateOrganizationSettings({ organizationId: member.organization.id, userId: member.id }, parsed.value);
  if (!result.ok) return { status: "error", message: result.error, values };
  revalidatePath("/app", "layout");
  return { status: "success", message: "Informations de l'organisation enregistrées." };
}

export async function updateRetentionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await responsibleMember();
  if (!member) return { status: "error", message: ROLE_ERROR };
  const months = parseRetention(String(formData.get("retentionMonths") ?? ""));
  if (months === null) return { status: "error", message: "Durée de conservation invalide." };

  const result = await updateRetentionMonths({ organizationId: member.organization.id, userId: member.id }, months);
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/app/parametres");
  return { status: "success", message: "Durée de conservation enregistrée." };
}

/** Effacement de l'organisation et de toutes ses données (propriétaire seulement, nom saisi en confirmation). */
export async function eraseOrganizationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  let result;
  try {
    result = await eraseOrganization(member, String(formData.get("confirmation") ?? ""));
  } catch (error) {
    console.error("Effacement de l'organisation interrompu", { message: error instanceof Error ? error.message : "inconnu" });
    return { status: "error", message: "L'effacement n'a pas pu aboutir. Réessayez, ou écrivez-nous." };
  }
  if (!result.ok) return { status: "error", message: result.error };

  // Le compte n'existe plus : on efface aussi la session de ce navigateur.
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
