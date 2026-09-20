"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { findTemplateViolations } from "@/lib/compliance/template-rules";
import { requireMember } from "@/lib/data/session";
import { sendReminderNow } from "@/lib/reminders/dispatch";
import { planRemindersForOrganization } from "@/lib/reminders/engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** File des relances. La validation est signée par le membre connecté (§2.3), la base revérifie tout. */

function refreshReminderPages() {
  revalidatePath("/app/relances");
  revalidatePath("/app/factures", "layout");
  revalidatePath("/app");
}

export type ReminderActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function planNowAction(): Promise<ReminderActionResult> {
  const member = await requireMember();
  const summary = await planRemindersForOrganization(member.organization.id);
  refreshReminderPages();
  if (!summary.hasAccess) {
    return { ok: false, error: "Votre essai est terminé : choisissez une offre dans les paramètres pour reprendre les relances." };
  }
  if (!summary.hasMailbox) return { ok: false, error: "Connectez d'abord une boîte d'envoi : les relances partent de votre adresse." };
  const missing = summary.missingEmail > 0 ? ` ${summary.missingEmail} client(s) sans adresse e-mail à compléter.` : "";
  return {
    ok: true,
    message:
      summary.planned === 0
        ? `Aucune nouvelle relance à préparer aujourd'hui.${missing}`
        : `${summary.planned} relance(s) préparée(s), dont ${summary.awaitingApproval} à valider.${missing}`,
  };
}

const approveSchema = z.object({
  reminderId: z.uuid(),
  subject: z.string().trim().min(1).max(200).nullable(),
  body: z.string().trim().min(1).max(5000).nullable(),
  clientType: z.enum(["b2b", "b2c"]),
});

export async function approveReminderAction(input: unknown): Promise<ReminderActionResult> {
  await requireMember();
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Texte de relance invalide." };
  const { reminderId, subject, body, clientType } = parsed.data;

  // Texte retouché : mêmes règles que les modèles (la base les revérifie aussi).
  if (subject !== null || body !== null) {
    const violations = findTemplateViolations({ clientType, subject: subject ?? "", body: body ?? "" });
    if (violations.length > 0) return { ok: false, error: violations.join(" ") };
  }

  const supabase = await createSupabaseServerClient();
  const { data: sendAt, error } = await supabase.rpc("approve_reminder", {
    p_reminder_id: reminderId,
    ...(subject !== null ? { p_subject: subject } : {}),
    ...(body !== null ? { p_body: body } : {}),
  });
  if (error) {
    console.error("Validation d'une relance refusée", { code: error.code, message: error.message });
    return { ok: false, error: error.code === "23514" ? "Ce texte enfreint les règles des relances." : "La relance n'a pas pu être validée." };
  }

  const isDueNow = Date.parse(sendAt) <= Date.now();
  const isSent = isDueNow ? await sendReminderNow(reminderId) : false;
  refreshReminderPages();
  if (!isDueNow) return { ok: true, message: "Relance validée : elle partira à l'heure prévue." };
  return isSent
    ? { ok: true, message: "Relance validée et envoyée depuis votre boîte." }
    : { ok: false, error: "Relance validée, mais l'envoi a échoué : vérifiez votre boîte d'envoi." };
}

export async function cancelReminderAction(input: unknown): Promise<ReminderActionResult> {
  await requireMember();
  const parsed = z.object({ reminderId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_reminder", { p_reminder_id: parsed.data.reminderId });
  if (error) return { ok: false, error: "Cette relance ne peut plus être annulée." };
  refreshReminderPages();
  return { ok: true, message: "Relance annulée." };
}

export async function setAutoSendAction(input: unknown): Promise<ReminderActionResult> {
  const member = await requireMember();
  if (member.role === "member") return { ok: false, error: "Réservé au propriétaire et aux administrateurs." };
  const parsed = z.object({ isEnabled: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({ auto_send: parsed.data.isEnabled })
    .eq("id", member.organization.id);
  if (error) return { ok: false, error: "Le réglage n'a pas pu être enregistré." };
  refreshReminderPages();
  return {
    ok: true,
    message: parsed.data.isEnabled ? "Envoi automatique activé." : "Envoi automatique désactivé : chaque relance attend votre validation.",
  };
}
