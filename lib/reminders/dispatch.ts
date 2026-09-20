import "server-only";
import { sendFromOrganizationMailbox } from "@/lib/mail/mailbox-sender";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import { markdownToHtml } from "@/lib/templates/engine";

/**
 * Envoi des relances dues, depuis la boîte du client (§2.1). Chaque relance est réservée avant
 * l'envoi (deux passages simultanés n'envoient pas deux fois), puis son résultat est enregistré.
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;
type Reminder = Tables<"reminders">;

export type DispatchSummary = { sent: number; failed: number };

const OPEN_STATUSES = new Set(["pending", "late"]);

async function recordResult(
  admin: Admin,
  reminderId: string,
  result: { ok: true; providerMessageId: string | null; threadId: string | null } | { ok: false; error: string },
) {
  const { error } = await admin.rpc("record_reminder_result", {
    p_reminder_id: reminderId,
    p_is_sent: result.ok,
    ...(result.ok
      ? {
          ...(result.providerMessageId ? { p_provider_message_id: result.providerMessageId } : {}),
          ...(result.threadId ? { p_provider_thread_id: result.threadId } : {}),
        }
      : { p_error: result.error }),
  });
  if (error) console.error("Résultat d'envoi non enregistré", { reminderId, message: error.message });
}

async function deliver(admin: Admin, reminder: Reminder): Promise<boolean> {
  const { data: invoice, error } = await admin
    .from("invoices")
    .select("status, reminders_paused_at, debtor:debtors (contact_email), organization:organizations (name)")
    .eq("id", reminder.invoice_id)
    .single();
  if (error) {
    await recordResult(admin, reminder.id, { ok: false, error: "Facture introuvable." });
    return false;
  }
  // Filet de sécurité : une facture réglée, contestée ou sous promesse n'est jamais relancée.
  if (!OPEN_STATUSES.has(invoice.status)) {
    await recordResult(admin, reminder.id, { ok: false, error: "La facture n'est plus à relancer." });
    return false;
  }
  // Le client a répondu entre la planification et l'envoi : on attend qu'un membre ait traité sa réponse.
  if (invoice.reminders_paused_at) {
    await recordResult(admin, reminder.id, { ok: false, error: "Relances suspendues : le client a répondu." });
    return false;
  }
  const to = invoice.debtor?.contact_email;
  if (!to || !reminder.subject || !reminder.body) {
    await recordResult(admin, reminder.id, { ok: false, error: "Adresse e-mail du client ou texte manquant." });
    return false;
  }

  const result = await sendFromOrganizationMailbox(
    reminder.organization_id,
    {
      to,
      subject: reminder.subject,
      text: reminder.body.replace(/\*\*(.+?)\*\*/g, "$1"),
      html: markdownToHtml(reminder.body),
    },
    invoice.organization?.name ?? "",
  );
  await recordResult(admin, reminder.id, result.ok ? result : { ok: false, error: result.error });
  return result.ok;
}

/** Un incident imprévu sur une relance est enregistré comme un échec ; il n'arrête pas le lot. */
async function deliverSafely(admin: Admin, reminder: Reminder): Promise<boolean> {
  try {
    return await deliver(admin, reminder);
  } catch (error) {
    console.error("Envoi de relance interrompu", {
      reminderId: reminder.id,
      message: error instanceof Error ? error.message : "inconnu",
    });
    await recordResult(admin, reminder.id, { ok: false, error: "Erreur inattendue pendant l'envoi." });
    return false;
  }
}

/** Relances dues, toutes organisations confondues (cron toutes les 15 minutes). */
export async function sendDueReminders(limit = 50): Promise<DispatchSummary> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_due_reminders", { p_limit: limit });
  if (error) throw new Error(`Réservation des relances impossible : ${error.message}`);

  const summary: DispatchSummary = { sent: 0, failed: 0 };
  for (const reminder of data) {
    if (await deliverSafely(admin, reminder)) summary.sent += 1;
    else summary.failed += 1;
  }
  return summary;
}

/** Une relance précise, validée à l'instant (« Valider et envoyer »). */
export async function sendReminderNow(reminderId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_reminder", { p_reminder_id: reminderId });
  if (error) throw new Error(`Réservation de la relance impossible : ${error.message}`);
  const reminder = data[0];
  return reminder ? deliverSafely(admin, reminder) : false;
}
