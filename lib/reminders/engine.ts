import "server-only";
import { getLLMProvider } from "@/lib/ai/mistral";
import { hasActiveAccess } from "@/lib/billing/access";
import { effectiveStatus, todayInParis } from "@/lib/invoices/dates";
import type { ClientType } from "@/lib/debtors/client-type";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ReminderTone } from "@/lib/templates/system-templates";
import { nextReminder, parisTimeToUtc, SEND_HOUR, SEND_MINUTE, type PlannerStep } from "./planner";
import { writeReminder } from "./writer";

/**
 * Préparation des relances du jour pour une organisation (cron quotidien, ou bouton « Préparer »).
 * Chaque relance est rédigée à partir du modèle de l'étape (et reformulée par l'IA si elle est
 * configurée), puis mise en attente de validation — ou planifiée si le client a activé l'envoi
 * automatique et que la règle de validation humaine (§2.3) est déjà satisfaite pour ce débiteur.
 * Les promesses échues sont d'abord soldées (relances reprises) ; une facture dont le client a
 * répondu reste en pause tant qu'un membre ne l'a pas traitée (§5.6).
 */

/** Relances préparées au plus par passage : borne la durée d'exécution (appels à l'IA). */
const MAX_REMINDERS_PER_RUN = 50;
const MAX_OPEN_INVOICES = 1000;

export type PlanningSummary = {
  planned: number;
  awaitingApproval: number;
  missingEmail: number;
  hasMailbox: boolean;
  /** Faux : essai terminé sans abonnement actif, aucune relance n'est préparée (§5.9). */
  hasAccess: boolean;
};

type TemplateRow = { id: string; client_type: ClientType; tone: ReminderTone; subject: string; body_markdown: string; is_system: boolean };

export async function planRemindersForOrganization(organizationId: string, today = todayInParis()): Promise<PlanningSummary> {
  const admin = createSupabaseAdminClient();
  const summary: PlanningSummary = { planned: 0, awaitingApproval: 0, missingEmail: 0, hasMailbox: false, hasAccess: true };

  const settled = await admin.rpc("settle_due_promises", { p_organization_id: organizationId });
  if (settled.error) throw new Error(`Promesses échues non soldées : ${settled.error.message}`);

  const [organization, mailbox, sequences, templates, invoices, approvedAi] = await Promise.all([
    admin.from("organizations").select("name, auto_send, subscription_status, trial_ends_at").eq("id", organizationId).single(),
    admin
      .from("email_accounts")
      .select("status")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("reminder_sequences")
      .select("client_type, reminder_steps (id, position, offset_days, tone, template_id)")
      .eq("organization_id", organizationId)
      .eq("is_default", true),
    admin
      .from("templates")
      .select("id, client_type, tone, subject, body_markdown, is_system")
      .or(`organization_id.eq.${organizationId},organization_id.is.null`),
    admin
      .from("invoices")
      .select(
        `id, number, amount_ttc, currency, issued_at, due_at, status,
         debtor:debtors (id, name, client_type, contact_name, contact_email),
         reminders!reminders_invoice_fkey (step_id, status, sent_at)`,
      )
      .eq("organization_id", organizationId)
      .in("status", ["pending", "late"])
      .is("reminders_paused_at", null)
      .order("due_at")
      .limit(MAX_OPEN_INVOICES),
    admin
      .from("reminders")
      .select("invoice:invoices!reminders_invoice_fkey (debtor_id)")
      .eq("organization_id", organizationId)
      .eq("ai_generated", true)
      .not("approved_by", "is", null),
  ]);
  const error = organization.error ?? mailbox.error ?? sequences.error ?? templates.error ?? invoices.error ?? approvedAi.error;
  if (error) throw new Error(`Préparation des relances impossible : ${error.message}`);
  const settings = organization.data;
  if (!settings) throw new Error("Préparation des relances impossible : organisation introuvable.");
  const sequenceRows = sequences.data ?? [];
  const templateRows = templates.data ?? [];
  const invoiceRows = invoices.data ?? [];
  const approvedRows = approvedAi.data ?? [];

  summary.hasAccess = hasActiveAccess({ subscriptionStatus: settings.subscription_status, trialEndsAt: settings.trial_ends_at });
  if (!summary.hasAccess) return summary;

  // Sans boîte d'envoi opérationnelle, rien à préparer : une relance ne partirait pas.
  summary.hasMailbox = mailbox.data?.status === "active";
  if (!summary.hasMailbox) return summary;

  const stepsByType = new Map(
    sequenceRows.map((sequence) => [
      sequence.client_type,
      sequence.reminder_steps.map(
        (step): PlannerStep & { templateId: string | null } => ({
          id: step.id,
          position: step.position,
          offsetDays: step.offset_days,
          tone: step.tone,
          templateId: step.template_id,
        }),
      ),
    ]),
  );
  const templateFor = (clientType: ClientType, tone: ReminderTone, templateId: string | null): TemplateRow | undefined =>
    templateRows.find((template) => template.id === templateId && template.client_type === clientType && template.tone === tone) ??
    templateRows.find((template) => template.is_system && template.client_type === clientType && template.tone === tone);
  const debtorsWithApprovedAi = new Set(approvedRows.map((row) => row.invoice?.debtor_id).filter(Boolean));
  const provider = getLLMProvider();

  for (const invoice of invoiceRows) {
    if (summary.planned >= MAX_REMINDERS_PER_RUN) break;
    const debtor = invoice.debtor;
    if (!debtor) continue;
    const steps = stepsByType.get(debtor.client_type) ?? [];
    const planned = nextReminder(
      { dueAt: invoice.due_at, status: effectiveStatus(invoice.status, invoice.due_at, today) },
      steps,
      invoice.reminders.map((reminder) => ({ stepId: reminder.step_id, status: reminder.status, sentAt: reminder.sent_at })),
      today,
    );
    if (!planned) continue;
    if (!debtor.contact_email) {
      summary.missingEmail += 1;
      continue;
    }

    const step = steps.find((candidate) => candidate.id === planned.step.id);
    const template = templateFor(debtor.client_type, planned.step.tone, step?.templateId ?? null);
    if (!template) continue;
    const written = await writeReminder({
      template: { clientType: template.client_type, tone: template.tone, subject: template.subject, bodyMarkdown: template.body_markdown },
      context: {
        debtor: { clientType: debtor.client_type, name: debtor.name, contactName: debtor.contact_name },
        invoice: {
          number: invoice.number,
          amountTtc: Number(invoice.amount_ttc),
          currency: invoice.currency,
          issuedAt: invoice.issued_at,
          dueAt: invoice.due_at,
        },
        organizationName: settings.name,
        today,
      },
      provider,
    });
    if (!written.ok) continue;

    // §2.3 : un texte de l'IA attend une validation humaine tant qu'aucun n'a été validé pour ce débiteur.
    const needsApproval =
      !settings.auto_send || (written.isAiGenerated && !debtorsWithApprovedAi.has(debtor.id));
    const { data: inserted, error: insertError } = await admin
      .from("reminders")
      .insert({
        organization_id: organizationId,
        invoice_id: invoice.id,
        step_id: planned.step.id,
        scheduled_at: parisTimeToUtc(planned.sendOn, SEND_HOUR, SEND_MINUTE),
        status: needsApproval ? "awaiting_approval" : "scheduled",
        subject: written.subject,
        body: written.bodyMarkdown,
        ai_generated: written.isAiGenerated,
      })
      .select("id")
      .single();
    if (insertError) {
      // 23505 : une autre préparation a créé la même relance entre-temps.
      if (insertError.code !== "23505") console.error("Relance non préparée", { code: insertError.code, message: insertError.message });
      continue;
    }

    summary.planned += 1;
    if (needsApproval) summary.awaitingApproval += 1;
    await admin.from("audit_logs").insert({
      organization_id: organizationId,
      actor_type: written.isAiGenerated ? "ai" : "system",
      action: "reminder.planned",
      entity_type: "reminder",
      entity_id: inserted.id,
      payload: { invoice_id: invoice.id, tone: planned.step.tone, awaiting_approval: needsApproval },
    });
  }

  return summary;
}
