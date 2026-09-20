"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isRateLimited, RATE_LIMITS, recordAttempt } from "@/lib/data/rate-limit";
import { requireMember } from "@/lib/data/session";
import { todayInParis } from "@/lib/invoices/dates";
import { checkRepliesForOrganization } from "@/lib/replies/inbox";
import { parsePromiseForm } from "@/lib/replies/promises";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Réponses des clients (§5.6) : chaque décision est prise par un membre et tracée par la base. */

export type ReplyActionResult = { ok: true; message: string } | { ok: false; error: string };

function refreshReplyPages() {
  revalidatePath("/app/reponses");
  revalidatePath("/app/relances");
  revalidatePath("/app/factures", "layout");
  revalidatePath("/app");
}

const RESOLUTION_MESSAGES = {
  keep_paused: "Réponse classée.",
  resume: "Relances reprises pour cette facture.",
  dispute: "Litige enregistré : la facture n'est plus relancée.",
  paid: "Facture marquée comme payée.",
} as const;

const resolveSchema = z.object({
  replyId: z.uuid(),
  resolution: z.enum(["keep_paused", "resume", "dispute", "paid"]),
  paidAt: z.iso.date().nullable(),
});

export async function resolveReplyAction(input: unknown): Promise<ReplyActionResult> {
  await requireMember();
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  const { replyId, resolution, paidAt } = parsed.data;
  if (resolution === "paid" && (!paidAt || paidAt > todayInParis())) {
    return { ok: false, error: "Indiquez une date de règlement qui n'est pas dans le futur." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("resolve_reply", {
    p_reply_id: replyId,
    p_resolution: resolution,
    ...(resolution === "paid" && paidAt ? { p_paid_at: paidAt } : {}),
  });
  if (error) {
    console.error("Traitement d'une réponse refusé", { code: error.code, message: error.message });
    return {
      ok: false,
      error: error.code === "P0002" ? "Cette réponse est introuvable." : "Cette réponse a déjà été traitée, ou la facture a changé entre-temps.",
    };
  }
  refreshReplyPages();
  return { ok: true, message: RESOLUTION_MESSAGES[resolution] };
}

const promiseSchema = z.object({
  invoiceId: z.uuid(),
  replyId: z.uuid().nullable(),
  promisedDate: z.string(),
  promisedAmount: z.string(),
});

export async function recordPromiseAction(input: unknown): Promise<ReplyActionResult> {
  await requireMember();
  const parsed = promiseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Promesse invalide." };
  const { invoiceId, replyId } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: invoice, error: readError } = await supabase.from("invoices").select("amount_ttc").eq("id", invoiceId).maybeSingle();
  if (readError || !invoice) return { ok: false, error: "Facture introuvable." };
  const promise = parsePromiseForm(parsed.data, todayInParis(), Number(invoice.amount_ttc));
  if (!promise.ok) return { ok: false, error: promise.error };

  const { error } = await supabase.rpc("record_promise", {
    p_invoice_id: invoiceId,
    p_promised_date: promise.value.promisedDate,
    ...(promise.value.promisedAmount !== null ? { p_promised_amount: promise.value.promisedAmount } : {}),
    ...(replyId ? { p_reply_id: replyId } : {}),
  });
  if (error) {
    console.error("Promesse refusée", { code: error.code, message: error.message });
    return { ok: false, error: "La promesse n'a pas pu être enregistrée : la facture n'est peut-être plus à régler." };
  }
  refreshReplyPages();
  return { ok: true, message: "Promesse enregistrée : pas de relance avant la date promise." };
}

export async function resumeRemindersAction(input: unknown): Promise<ReplyActionResult> {
  await requireMember();
  const parsed = z.object({ invoiceId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("resume_reminders", { p_invoice_id: parsed.data.invoiceId });
  if (error) {
    console.error("Reprise des relances refusée", { code: error.code, message: error.message });
    return { ok: false, error: "Les relances de cette facture ne sont pas suspendues." };
  }
  refreshReplyPages();
  return { ok: true, message: "Relances reprises : la prochaine sera préparée selon le scénario." };
}

/** Lecture immédiate de la boîte (en plus du passage automatique toutes les 30 minutes). */
export async function checkRepliesNowAction(): Promise<ReplyActionResult> {
  const member = await requireMember();
  if (await isRateLimited(member.organization.id, RATE_LIMITS.repliesCheck)) {
    return { ok: false, error: "Vérification déjà faite il y a peu : réessayez dans quelques minutes." };
  }
  const summary = await checkRepliesForOrganization(member.organization.id);
  await recordAttempt(member.organization.id, member.id, RATE_LIMITS.repliesCheck, { ok: summary.status === "checked" });
  refreshReplyPages();

  switch (summary.status) {
    case "failed":
      return { ok: false, error: summary.error };
    case "skipped":
      return {
        ok: false,
        error:
          summary.reason === "no_imap"
            ? "Relia ne lit pas cette boîte : indiquez son serveur IMAP dans « Boîte d'envoi »."
            : summary.reason === "no_access"
              ? "Votre essai est terminé : choisissez une offre dans les paramètres pour que Relia lise à nouveau vos réponses."
              : "Aucune boîte d'envoi opérationnelle à lire.",
      };
    case "checked": {
      if (summary.recorded === 0) return { ok: true, message: "Aucune nouvelle réponse." };
      const parts = [
        `${summary.recorded} nouvelle(s) réponse(s)`,
        summary.promises > 0 && `${summary.promises} promesse(s) enregistrée(s)`,
        summary.needsAttention > 0 && `${summary.needsAttention} à traiter`,
      ].filter(Boolean);
      return { ok: true, message: `${parts.join(", ")}.` };
    }
  }
}
