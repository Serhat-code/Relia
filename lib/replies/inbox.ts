import "server-only";
import { getLLMProvider } from "@/lib/ai/mistral";
import { hasActiveAccess } from "@/lib/billing/access";
import type { LLMProvider } from "@/lib/ai/llm-provider";
import { todayInParis } from "@/lib/invoices/dates";
import {
  currentAccessToken,
  loadMailboxCredentials,
  markMailboxStatus,
  RECONNECT_MESSAGE,
  type MailboxCredentials,
} from "@/lib/mail/mailbox-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { classifyReply } from "./classify";
import { parseIncomingMessage } from "./incoming";
import { replyExcerpt } from "./quote";
import { gmailReader, imapReader, outlookReader, ReaderError, type Candidate, type MailboxReader, type ReaderContext } from "./readers";
import { indexByMessageId, matchInRawText, readSince, type SentReminderRef } from "./threads";

/**
 * Lecture des réponses d'une organisation (cron toutes les 30 minutes, ou bouton « Vérifier »).
 * Les réponses sont rattachées à leur relance, classées (IA hébergée dans l'UE, sinon règles), puis
 * enregistrées par la base, qui applique les promesses et suspend les relances (§5.6).
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** Relances envoyées dont on suit les réponses. */
const REPLY_WINDOW_DAYS = 60;
const MAX_TRACKED_REMINDERS = 500;
/** Réponses analysées au plus par passage : borne la durée d'exécution (appels à l'IA). */
const MAX_REPLIES_PER_RUN = 30;
/** Taille des lots de vérification des messages déjà enregistrés (longueur d'URL de l'API). */
const KNOWN_ID_BATCH = 100;

export type ReplyCheckSummary =
  | { status: "checked"; recorded: number; needsAttention: number; promises: number }
  | { status: "skipped"; reason: "no_mailbox" | "inactive" | "no_imap" | "no_access" }
  | { status: "failed"; error: string };

type TrackedInvoice = { number: string; amountTtc: number; dueAt: string };

type Tracking = { reminders: SentReminderRef[]; invoices: Map<string, TrackedInvoice>; checkedAt: string | null; imap: { host: string; port: number } | null };

async function loadTracking(admin: Admin, organizationId: string, accountId: string, now: Date): Promise<Tracking> {
  const windowStart = new Date(now.getTime() - REPLY_WINDOW_DAYS * 86_400_000).toISOString();
  const [settings, sent] = await Promise.all([
    admin.from("email_accounts").select("imap_host, imap_port, replies_checked_at").eq("id", accountId).single(),
    admin
      .from("reminders")
      .select("id, invoice_id, provider_message_id, provider_thread_id, sent_at, invoice:invoices!reminders_invoice_fkey (number, amount_ttc, due_at)")
      .eq("organization_id", organizationId)
      .eq("status", "sent")
      .gte("sent_at", windowStart)
      .order("sent_at", { ascending: false })
      .limit(MAX_TRACKED_REMINDERS),
  ]);
  if (settings.error || sent.error) {
    throw new Error(`Lecture des relances suivies impossible : ${(settings.error ?? sent.error)?.message}`);
  }

  const reminders: SentReminderRef[] = [];
  const invoices = new Map<string, TrackedInvoice>();
  for (const row of sent.data) {
    if (!row.sent_at || !row.invoice) continue;
    reminders.push({
      reminderId: row.id,
      invoiceId: row.invoice_id,
      threadId: row.provider_thread_id,
      providerMessageId: row.provider_message_id,
      sentAt: row.sent_at,
    });
    invoices.set(row.id, { number: row.invoice.number, amountTtc: Number(row.invoice.amount_ttc), dueAt: row.invoice.due_at });
  }
  const { imap_host: host, imap_port: port } = settings.data;
  return { reminders, invoices, checkedAt: settings.data.replies_checked_at, imap: host && port ? { host, port } : null };
}

async function openReader(
  admin: Admin,
  organizationId: string,
  account: MailboxCredentials,
  imap: Tracking["imap"],
  context: ReaderContext,
): Promise<MailboxReader> {
  if (account.provider === "smtp") {
    if (!imap || !account.smtp_user || !account.smtp_password) throw new ReaderError("Serveur IMAP non configuré.", false);
    return imapReader({ host: imap.host, port: imap.port, user: account.smtp_user, password: account.smtp_password }, context);
  }
  const accessToken = await currentAccessToken(admin, organizationId, account);
  if (!accessToken) {
    await markMailboxStatus(admin, account.id, "error");
    throw new ReaderError(RECONNECT_MESSAGE, true);
  }
  return account.provider === "gmail" ? gmailReader(accessToken, context) : outlookReader(accessToken, context);
}

/** Identifiants déjà enregistrés : une lecture qui chevauche la précédente ne refait rien. */
async function knownMessageIds(admin: Admin, organizationId: string, ids: readonly string[]): Promise<Set<string>> {
  const known = new Set<string>();
  for (let start = 0; start < ids.length; start += KNOWN_ID_BATCH) {
    const { data, error } = await admin
      .from("replies")
      .select("provider_message_id")
      .eq("organization_id", organizationId)
      .in("provider_message_id", ids.slice(start, start + KNOWN_ID_BATCH));
    if (error) throw new Error(`Lecture des réponses enregistrées impossible : ${error.message}`);
    for (const row of data) known.add(row.provider_message_id);
  }
  return known;
}

type Outcome = { kind: string; hasPromise: boolean } | null;

type ProcessContext = {
  admin: Admin;
  organizationId: string;
  mailboxAddress: string;
  tracking: Tracking;
  byMessageId: ReturnType<typeof indexByMessageId>;
  provider: LLMProvider | null;
  now: Date;
};

/** Réponse trop volumineuse pour être analysée : enregistrée sans extrait, elle suspend quand même les relances. */
async function recordOversizedReply(candidate: Candidate, receivedAt: Date | null, context: ProcessContext): Promise<Outcome> {
  if (!candidate.reminder) return null;
  const { data, error } = await context.admin.rpc("record_reply", {
    p_organization_id: context.organizationId,
    p_reminder_id: candidate.reminder.reminderId,
    p_provider_message_id: candidate.providerMessageId,
    p_received_at: (receivedAt ?? context.now).toISOString(),
    p_kind: "other",
  });
  if (error) throw new Error(`Réponse non enregistrée : ${error.message}`);
  return data ? { kind: "other", hasPromise: false } : null;
}

async function processCandidate(reader: MailboxReader, candidate: Candidate, context: ProcessContext): Promise<Outcome> {
  const fetched = await reader.fetchRaw(candidate);
  if (!fetched) return null;
  if (!fetched.raw) return recordOversizedReply(candidate, fetched.receivedAt, context);
  const incoming = await parseIncomingMessage(fetched.raw);
  if (incoming.fromAddress === context.mailboxAddress) return null;

  const reminder =
    candidate.reminder ?? (incoming.automated === "bounce" ? matchInRawText(fetched.raw.toString("latin1"), context.byMessageId) : null);
  const invoice = reminder ? context.tracking.invoices.get(reminder.reminderId) : undefined;
  if (!reminder || !invoice) return null;

  const receivedAt = fetched.receivedAt ?? incoming.sentAt ?? context.now;
  const classification = incoming.automated
    ? null
    : await classifyReply({ text: incoming.text, receivedOn: todayInParis(receivedAt), invoice, provider: context.provider });
  const kind = incoming.automated ?? classification?.kind ?? "other";
  const excerpt = incoming.automated ? "" : replyExcerpt(incoming.text);

  const { data, error } = await context.admin.rpc("record_reply", {
    p_organization_id: context.organizationId,
    p_reminder_id: reminder.reminderId,
    p_provider_message_id: candidate.providerMessageId,
    p_received_at: receivedAt.toISOString(),
    p_kind: kind,
    ...(excerpt ? { p_excerpt: excerpt } : {}),
    ...(classification
      ? {
          p_ai_classified: classification.isAiClassified,
          p_confidence: classification.confidence,
          ...(classification.promisedDate ? { p_promised_date: classification.promisedDate } : {}),
          ...(classification.promisedAmount !== null ? { p_promised_amount: classification.promisedAmount } : {}),
        }
      : {}),
  });
  if (error) throw new Error(`Réponse non enregistrée : ${error.message}`);
  // Null : déjà enregistrée par une lecture simultanée.
  return data ? { kind, hasPromise: kind === "promise" && Boolean(classification?.promisedDate) } : null;
}

async function recordCheck(admin: Admin, accountId: string, update: { replies_checked_at?: string; replies_error: string | null }) {
  const { error } = await admin.from("email_accounts").update(update).eq("id", accountId);
  if (error) console.error("Lecture des réponses : état non enregistré", { message: error.message });
}

const errorMessage = (error: unknown) => (error instanceof ReaderError ? error.message : "Lecture des réponses interrompue.");

export async function checkRepliesForOrganization(organizationId: string, now = new Date()): Promise<ReplyCheckSummary> {
  const admin = createSupabaseAdminClient();
  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("subscription_status, trial_ends_at")
    .eq("id", organizationId)
    .single();
  if (organizationError) throw new Error(`Lecture de l'organisation impossible : ${organizationError.message}`);
  // Essai terminé sans abonnement : la boîte n'est plus lue (ni analysée par l'IA).
  if (!hasActiveAccess({ subscriptionStatus: organization.subscription_status, trialEndsAt: organization.trial_ends_at })) {
    return { status: "skipped", reason: "no_access" };
  }
  const account = await loadMailboxCredentials(admin, organizationId);
  if (!account) return { status: "skipped", reason: "no_mailbox" };
  if (account.status !== "active") return { status: "skipped", reason: "inactive" };

  const tracking = await loadTracking(admin, organizationId, account.id, now);
  if (account.provider === "smtp" && !tracking.imap) return { status: "skipped", reason: "no_imap" };
  const summary = { status: "checked" as const, recorded: 0, needsAttention: 0, promises: 0 };
  if (tracking.reminders.length === 0) {
    await recordCheck(admin, account.id, { replies_checked_at: now.toISOString(), replies_error: null });
    return summary;
  }

  const oldestSentAt = tracking.reminders.reduce((oldest, reminder) => (reminder.sentAt < oldest ? reminder.sentAt : oldest), now.toISOString());
  const context: ReaderContext = {
    since: readSince(tracking.checkedAt, oldestSentAt, now),
    mailboxAddress: account.email_address.toLowerCase(),
    reminders: tracking.reminders,
  };

  let reader: MailboxReader;
  try {
    reader = await openReader(admin, organizationId, account, tracking.imap, context);
  } catch (error) {
    const message = errorMessage(error);
    await recordCheck(admin, account.id, { replies_error: message });
    return { status: "failed", error: message };
  }

  const processContext: ProcessContext = {
    admin,
    organizationId,
    mailboxAddress: context.mailboxAddress,
    tracking,
    byMessageId: indexByMessageId(tracking.reminders),
    provider: getLLMProvider(),
    now,
  };
  let hasMore = false;
  try {
    const candidates = await reader.listCandidates();
    const known = await knownMessageIds(admin, organizationId, candidates.map((candidate) => candidate.providerMessageId));
    const fresh = candidates.filter((candidate) => !known.has(candidate.providerMessageId));
    hasMore = fresh.length > MAX_REPLIES_PER_RUN;
    for (const candidate of fresh.slice(0, MAX_REPLIES_PER_RUN)) {
      // Un message illisible ou refusé par la base n'arrête pas la lecture des autres.
      try {
        const outcome = await processCandidate(reader, candidate, processContext);
        if (!outcome) continue;
        summary.recorded += 1;
        if (outcome.hasPromise) summary.promises += 1;
        else if (outcome.kind !== "auto_reply") summary.needsAttention += 1;
      } catch (error) {
        if (error instanceof ReaderError) throw error;
        console.error("Réponse ignorée", { organizationId, message: error instanceof Error ? error.message : "inconnu" });
      }
    }
  } catch (error) {
    const message = errorMessage(error);
    console.error("Lecture des réponses en échec", { organizationId, message: error instanceof Error ? error.message : "inconnu" });
    await recordCheck(admin, account.id, { replies_error: message });
    return { status: "failed", error: message };
  } finally {
    await reader.close().catch(() => undefined);
  }

  // S'il reste des réponses à analyser, la date de lecture n'avance pas : le passage suivant les reprend.
  await recordCheck(admin, account.id, hasMore ? { replies_error: null } : { replies_checked_at: now.toISOString(), replies_error: null });
  return summary;
}
