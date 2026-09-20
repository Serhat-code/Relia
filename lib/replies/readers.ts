import "server-only";
import { createHash } from "node:crypto";
import type { ImapFlow } from "imapflow";
import { z } from "zod";
import { isAuthFailure, readBodyWithin, requestProvider } from "@/lib/mail/http";
import { IMAP_UNREACHABLE, isImapAuthError, openImap, type ImapSettings } from "@/lib/mail/imap";
import { normalizeMessageId, parseMessageIdList } from "@/lib/mail/message-id";
import { isBounceSender } from "./automated";
import { indexByMessageId, indexByThread, matchByReferences, type SentReminderRef } from "./threads";

/**
 * Lecture des réponses dans la boîte du client. Chaque lecteur liste d'abord les messages reçus
 * depuis la dernière lecture qui appartiennent à un fil de relance (identifiants seulement), puis
 * ne télécharge que ceux-là : Relia ne lit jamais le reste de la messagerie.
 */

export type Candidate = {
  /** Identifiant chez le fournisseur : une réponse n'est enregistrée qu'une fois. */
  providerMessageId: string;
  /** Relance du fil ; null pour un avis de non-remise IMAP, rattaché d'après son contenu. */
  reminder: SentReminderRef | null;
  receivedAt: Date | null;
  fetchKey: string;
  /** Taille connue dès la liste (IMAP) et supérieure à la limite : le message n'est pas téléchargé. */
  isTooLarge?: boolean;
};

/** Message brut, ou null s'il dépasse MAX_MESSAGE_BYTES : il n'est alors ni téléchargé ni analysé. */
export type FetchedMessage = { raw: Buffer | null; receivedAt: Date | null };

/**
 * Taille maximale d'un message analysé. Une réponse à une relance tient en quelques Ko ; au-delà,
 * ce sont des pièces jointes, que Relia n'a pas à lire (le client consulte le message chez lui).
 */
export const MAX_MESSAGE_BYTES = 1_000_000;

export type MailboxReader = {
  listCandidates(): Promise<Candidate[]>;
  fetchRaw(candidate: Candidate): Promise<FetchedMessage | null>;
  close(): Promise<void>;
};

export type ReaderContext = { since: Date; mailboxAddress: string; reminders: readonly SentReminderRef[] };

/** Échec de lecture, avec un motif affichable au client. */
export class ReaderError extends Error {
  constructor(
    message: string,
    readonly isAuthError: boolean,
  ) {
    super(message);
  }
}

/** Pages de résultats lues au plus par passage (100 messages par page). */
const MAX_LIST_PAGES = 5;

async function getProviderJson<T>(url: string | URL, init: RequestInit, provider: string, schema: z.ZodType<T>): Promise<T> {
  const response = await requestProvider(url, init);
  if (!response) throw new ReaderError(`${provider} injoignable (délai dépassé ou erreur réseau).`, false);
  if (!response.ok) {
    const isAuthError = isAuthFailure(response.status);
    throw new ReaderError(
      isAuthError
        ? `${provider} a refusé la lecture des réponses : reconnectez la boîte en autorisant la lecture des e-mails.`
        : `${provider} a refusé la lecture des réponses (${response.status}).`,
      isAuthError,
    );
  }
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new ReaderError(`Réponse inattendue de ${provider}.`, false);
  return parsed.data;
}

// ─── Gmail ──────────────────────────────────────────────────────────────────────

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

const gmailListSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1), threadId: z.string().min(1) })).optional(),
  nextPageToken: z.string().optional(),
});

const gmailMinimalSchema = z.object({ sizeEstimate: z.number().optional(), internalDate: z.string().regex(/^\d+$/).optional() });

const gmailRawSchema = z.object({ raw: z.string().min(1) });

/** Base64url : 4 caractères pour 3 octets. */
const MAX_GMAIL_RAW_LENGTH = Math.ceil((MAX_MESSAGE_BYTES * 4) / 3) + 4;

export function gmailReader(accessToken: string, context: ReaderContext): MailboxReader {
  const init = { headers: { Authorization: `Bearer ${accessToken}` } };
  const byThread = indexByThread(context.reminders);

  return {
    async listCandidates() {
      const candidates: Candidate[] = [];
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
        const url = new URL(`${GMAIL_API}/messages`);
        // « -from:me » : ni les relances elles-mêmes, ni les réponses du client à ses débiteurs.
        url.searchParams.set("q", `after:${Math.floor(context.since.getTime() / 1000)} -from:me`);
        url.searchParams.set("maxResults", "100");
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        const body = await getProviderJson(url, init, "Gmail", gmailListSchema);
        for (const message of body.messages ?? []) {
          const reminder = byThread.get(message.threadId);
          if (reminder) candidates.push({ providerMessageId: message.id, reminder, receivedAt: null, fetchKey: message.id });
        }
        pageToken = body.nextPageToken;
        if (!pageToken) break;
      }
      return candidates;
    },
    async fetchRaw(candidate) {
      // Taille d'abord (réponse de quelques octets) : un message trop lourd n'est pas téléchargé.
      const messageUrl = `${GMAIL_API}/messages/${encodeURIComponent(candidate.fetchKey)}`;
      const meta = await getProviderJson(`${messageUrl}?format=minimal`, init, "Gmail", gmailMinimalSchema);
      const receivedAt = meta.internalDate ? new Date(Number(meta.internalDate)) : null;
      if ((meta.sizeEstimate ?? 0) > MAX_MESSAGE_BYTES) return { raw: null, receivedAt };
      const body = await getProviderJson(`${messageUrl}?format=raw`, init, "Gmail", gmailRawSchema);
      // L'estimation de taille peut être dépassée : le message est alors traité comme trop volumineux.
      if (body.raw.length > MAX_GMAIL_RAW_LENGTH) return { raw: null, receivedAt };
      return { raw: Buffer.from(body.raw, "base64url"), receivedAt };
    },
    async close() {},
  };
}

// ─── Outlook (Microsoft Graph) ──────────────────────────────────────────────────

const GRAPH_API = "https://graph.microsoft.com/v1.0/me";

const graphListSchema = z.object({
  value: z.array(
    z.object({
      id: z.string().min(1),
      conversationId: z.string().nullable().optional(),
      receivedDateTime: z.string().optional(),
      from: z.object({ emailAddress: z.object({ address: z.string().optional() }).optional() }).nullable().optional(),
    }),
  ),
  "@odata.nextLink": z.string().optional(),
});

export function outlookReader(accessToken: string, context: ReaderContext): MailboxReader {
  // Identifiants immuables : les mêmes qu'à l'envoi, même si le message est classé ailleurs.
  const headers = { Authorization: `Bearer ${accessToken}`, Prefer: 'IdType="ImmutableId"' };
  const byThread = indexByThread(context.reminders);

  return {
    async listCandidates() {
      const candidates: Candidate[] = [];
      const first = new URL(`${GRAPH_API}/messages`);
      first.searchParams.set("$filter", `receivedDateTime ge ${context.since.toISOString()}`);
      first.searchParams.set("$select", "id,conversationId,receivedDateTime,from");
      first.searchParams.set("$orderby", "receivedDateTime desc");
      first.searchParams.set("$top", "100");
      let url: string | null = first.toString();

      for (let page = 0; page < MAX_LIST_PAGES && url; page += 1) {
        const body: z.infer<typeof graphListSchema> = await getProviderJson(url, { headers }, "Outlook", graphListSchema);
        for (const message of body.value) {
          const reminder = message.conversationId ? byThread.get(message.conversationId) : undefined;
          const from = message.from?.emailAddress?.address?.toLowerCase();
          if (!reminder || from === context.mailboxAddress) continue;
          const receivedAt = message.receivedDateTime ? new Date(message.receivedDateTime) : null;
          candidates.push({ providerMessageId: message.id, reminder, receivedAt, fetchKey: message.id });
        }
        // La page suivante ne peut mener qu'à Microsoft Graph.
        const next: string | undefined = body["@odata.nextLink"];
        url = next?.startsWith(`${GRAPH_API}/`) ? next : null;
      }
      return candidates;
    },
    async fetchRaw(candidate) {
      const response = await requestProvider(`${GRAPH_API}/messages/${encodeURIComponent(candidate.fetchKey)}/$value`, { headers });
      if (!response) throw new ReaderError("Outlook injoignable (délai dépassé ou erreur réseau).", false);
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new ReaderError(`Outlook a refusé la lecture d'une réponse (${response.status}).`, isAuthFailure(response.status));
      }
      return { raw: await readBodyWithin(response, MAX_MESSAGE_BYTES), receivedAt: candidate.receivedAt };
    },
    async close() {},
  };
}

// ─── IMAP (repli SMTP) ──────────────────────────────────────────────────────────

/** Messages examinés au plus par passage (les plus récents). */
const MAX_IMAP_SCAN = 500;

function referencesHeader(headers: Buffer | undefined): string {
  if (!headers) return "";
  const text = headers.toString("utf8").replace(/\r?\n[ \t]+/g, " ");
  return /^references:(.*)$/im.exec(text)?.[1]?.trim() ?? "";
}

const asDate = (value: Date | string | undefined) => (value ? new Date(value) : null);

/**
 * Identifiant d'un message IMAP pour le dédoublonnage. Le Message-ID est choisi par l'expéditeur : il est
 * remplacé par son empreinte, pour qu'un identifiant piégé (guillemets, virgules, parenthèses, longueur)
 * ne puisse ni casser les filtres de l'API ni dépasser les limites de la base.
 */
export function imapMessageKey(messageId: string | null | undefined, uidValidity: string, uid: number): string {
  const normalized = messageId ? normalizeMessageId(messageId) : "";
  return normalized ? `imap:${createHash("sha256").update(normalized).digest("hex")}` : `imap:${uidValidity}:${uid}`;
}

async function connectImap(settings: ImapSettings): Promise<ImapFlow> {
  try {
    const client = await openImap(settings);
    if (!client) throw new ReaderError(IMAP_UNREACHABLE, false);
    return client;
  } catch (error) {
    if (error instanceof ReaderError) throw error;
    throw isImapAuthError(error)
      ? new ReaderError("Le serveur IMAP a refusé l'identifiant ou le mot de passe.", true)
      : new ReaderError("Connexion au serveur IMAP impossible.", false);
  }
}

export async function imapReader(settings: ImapSettings, context: ReaderContext): Promise<MailboxReader> {
  const client = await connectImap(settings);
  const lock = await client.getMailboxLock("INBOX");
  const byMessageId = indexByMessageId(context.reminders);

  return {
    async listCandidates() {
      const uids = await client.search({ since: context.since }, { uid: true });
      if (!uids || uids.length === 0) return [];
      const uidValidity = client.mailbox ? String(client.mailbox.uidValidity) : "0";
      const candidates: Candidate[] = [];
      const query = { uid: true, envelope: true, internalDate: true, size: true, headers: ["references"] };
      for await (const message of client.fetch(uids.slice(-MAX_IMAP_SCAN), query, { uid: true })) {
        const from = message.envelope?.from?.[0]?.address?.toLowerCase() ?? null;
        if (!from || from === context.mailboxAddress) continue;
        const referenced = [
          ...parseMessageIdList(message.envelope?.inReplyTo),
          ...parseMessageIdList(referencesHeader(message.headers)).reverse(),
        ];
        const reminder = matchByReferences(referenced, byMessageId);
        // Un avis de non-remise est rattaché plus tard, d'après les en-têtes d'origine qu'il joint.
        if (!reminder && !isBounceSender(from)) continue;
        candidates.push({
          providerMessageId: imapMessageKey(message.envelope?.messageId, uidValidity, message.uid),
          reminder,
          receivedAt: asDate(message.internalDate),
          fetchKey: String(message.uid),
          isTooLarge: (message.size ?? 0) > MAX_MESSAGE_BYTES,
        });
      }
      return candidates;
    },
    async fetchRaw(candidate) {
      if (candidate.isTooLarge) return { raw: null, receivedAt: candidate.receivedAt };
      const message = await client.fetchOne(candidate.fetchKey, { source: { maxLength: MAX_MESSAGE_BYTES } }, { uid: true });
      if (!message || !message.source) return null;
      return { raw: message.source, receivedAt: candidate.receivedAt };
    },
    async close() {
      lock.release();
      await client.logout().catch(() => undefined);
      client.close();
    },
  };
}
