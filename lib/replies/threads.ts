import { normalizeMessageId } from "@/lib/mail/message-id";

/**
 * Rattachement d'un message reçu à la relance à laquelle il répond. Gmail et Outlook regroupent
 * les messages par fil (identifiant de fil ou de conversation, noté à l'envoi) ; en IMAP, la
 * réponse cite l'identifiant du message de relance (In-Reply-To, References).
 */

export type SentReminderRef = {
  reminderId: string;
  invoiceId: string;
  /** Fil Gmail, conversation Outlook, ou identifiant du message pour le SMTP. */
  threadId: string | null;
  /** Identifiant du message chez le fournisseur (Message-ID pour le SMTP). */
  providerMessageId: string | null;
  sentAt: string;
};

/** Fil → relance la plus récente de ce fil (une facture relancée plusieurs fois dans le même fil). */
export function indexByThread(reminders: readonly SentReminderRef[]): Map<string, SentReminderRef> {
  const index = new Map<string, SentReminderRef>();
  for (const reminder of reminders) {
    if (!reminder.threadId) continue;
    const current = index.get(reminder.threadId);
    if (!current || current.sentAt < reminder.sentAt) index.set(reminder.threadId, reminder);
  }
  return index;
}

/** Identifiant de message normalisé → relance (SMTP : Message-ID choisi à l'envoi). */
export function indexByMessageId(reminders: readonly SentReminderRef[]): Map<string, SentReminderRef> {
  const index = new Map<string, SentReminderRef>();
  for (const reminder of reminders) {
    for (const id of [reminder.providerMessageId, reminder.threadId]) {
      if (id) index.set(normalizeMessageId(id), reminder);
    }
  }
  return index;
}

/** Relance citée par une réponse : In-Reply-To d'abord, puis les références les plus récentes. */
export function matchByReferences(
  referencedIds: readonly string[],
  byMessageId: ReadonlyMap<string, SentReminderRef>,
): SentReminderRef | null {
  for (const id of referencedIds) {
    const reminder = byMessageId.get(normalizeMessageId(id));
    if (reminder) return reminder;
  }
  return null;
}

/**
 * Avis de non-remise : il ne cite pas toujours la relance dans ses en-têtes, mais en joint les
 * en-têtes d'origine. On cherche alors un identifiant connu dans le texte brut.
 */
export function matchInRawText(raw: string, byMessageId: ReadonlyMap<string, SentReminderRef>): SentReminderRef | null {
  const found = raw.match(/<[^<>\s@]{1,300}@[^<>\s]{1,255}>/g) ?? [];
  return matchByReferences(found, byMessageId);
}

/**
 * Depuis quand lire la boîte : la dernière lecture moins une marge d'une heure (pour ne pas perdre les
 * messages arrivés pendant la lecture précédente), jamais avant la plus ancienne relance suivie, ni
 * au-delà de la fenêtre de lecture.
 */
export const READ_OVERLAP_MS = 60 * 60_000;
export const MAX_LOOKBACK_DAYS = 14;

export function readSince(lastCheckedAt: string | null, oldestSentAt: string | null, now: Date): Date {
  const floor = now.getTime() - MAX_LOOKBACK_DAYS * 86_400_000;
  const candidates = [floor];
  if (lastCheckedAt) candidates.push(Date.parse(lastCheckedAt) - READ_OVERLAP_MS);
  if (oldestSentAt) candidates.push(Date.parse(oldestSentAt));
  return new Date(Math.max(...candidates.filter(Number.isFinite)));
}
