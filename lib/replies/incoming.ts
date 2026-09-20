import { simpleParser } from "mailparser";
import { parseMessageIdList } from "@/lib/mail/message-id";
import { detectAutomatedMessage, headerMap, type AutomatedKind } from "./automated";
import { htmlToText, stripQuotedReply } from "./quote";

/**
 * Message reçu dans la boîte du client, au format MIME brut (Gmail, Microsoft Graph et IMAP le
 * fournissent tous) : on n'en garde que ce qui sert à le rattacher et à le classer.
 */

export type IncomingMessage = {
  messageId: string | null;
  /** Identifiants cités (In-Reply-To puis References), normalisés. */
  referencedIds: string[];
  fromAddress: string | null;
  subject: string;
  sentAt: Date | null;
  /** Ce que le client a écrit, sans la relance citée ni la signature. */
  text: string;
  automated: AutomatedKind | null;
};

/**
 * Bornes appliquées avant les expressions régulières : une réponse tient en quelques Ko, la citation
 * et la signature viennent après. (L'option maxHtmlLengthToParse de mailparser est sans effet quand
 * skipHtmlToText est vrai : la borne est donc appliquée ici.)
 */
const MAX_HTML_LENGTH = 200_000;
const MAX_TEXT_LENGTH = 50_000;

/** En-tête brut « Nom: valeur », lignes de continuation dépliées (RFC 5322 § 2.2.3). */
function headerValue(line: string): string {
  const colon = line.indexOf(":");
  return (colon === -1 ? "" : line.slice(colon + 1)).replace(/\r?\n[ \t]+/g, " ").trim();
}

export async function parseIncomingMessage(raw: Buffer | string): Promise<IncomingMessage> {
  const parsed = await simpleParser(raw, {
    skipHtmlToText: true,
    skipTextToHtml: true,
    skipImageLinks: true,
    skipTextLinks: true,
  });
  const headers = headerMap(parsed.headerLines.map(({ key, line }) => [key, headerValue(line)] as const));
  const fromAddress = parsed.from?.value[0]?.address?.toLowerCase() ?? null;
  const subject = parsed.subject ?? "";
  const body = parsed.text?.trim()
    ? parsed.text.slice(0, MAX_TEXT_LENGTH)
    : parsed.html
      ? htmlToText(parsed.html.slice(0, MAX_HTML_LENGTH)).slice(0, MAX_TEXT_LENGTH)
      : "";
  const inReplyTo = parseMessageIdList(parsed.inReplyTo);
  const references = parseMessageIdList(parsed.references).reverse();

  return {
    messageId: parseMessageIdList(parsed.messageId)[0] ?? null,
    referencedIds: [...new Set([...inReplyTo, ...references])],
    fromAddress,
    subject,
    sentAt: parsed.date ?? null,
    text: stripQuotedReply(body),
    automated: detectAutomatedMessage(headers, subject, fromAddress),
  };
}
