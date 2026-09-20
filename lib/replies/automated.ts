/**
 * Messages automatiques : un message d'absence ne suspend pas les relances, un avis de
 * non-remise signale une adresse à vérifier. Détection sur les en-têtes normalisés
 * (RFC 3834 « Auto-Submitted », usages d'Exchange et de Gmail), puis sur l'objet.
 */

export type AutomatedKind = "auto_reply" | "bounce";

export type MessageHeaders = ReadonlyMap<string, string>;

/** En-têtes indexés en minuscules, première valeur retenue. */
export function headerMap(entries: Iterable<readonly [string, string]>): MessageHeaders {
  const map = new Map<string, string>();
  for (const [name, value] of entries) {
    const key = name.toLowerCase();
    if (!map.has(key)) map.set(key, value);
  }
  return map;
}

const BOUNCE_SENDER = /^(mailer-daemon|postmaster|mail-daemon)@/i;

/** Expéditeur des avis de non-remise (serveurs de messagerie). */
export const isBounceSender = (address: string) => BOUNCE_SENDER.test(address);
const BOUNCE_SUBJECT =
  /(undeliverable|undelivered|delivery status notification|delivery has failed|mail delivery failed|returned mail|non remis|échec de (la )?(remise|distribution)|message non distribué)/i;
const AUTO_REPLY_SUBJECT =
  /^\s*(réponse automatique|automatic reply|auto(matische)?[ -]?(reply|antwort)|auto\s*:|absent(e)?\b|absence\b|out of (the )?office|en congés?\b|message d'absence)/i;

export function detectAutomatedMessage(headers: MessageHeaders, subject: string, fromAddress: string | null): AutomatedKind | null {
  const contentType = headers.get("content-type") ?? "";
  if (
    (fromAddress && BOUNCE_SENDER.test(fromAddress)) ||
    /multipart\/report/i.test(contentType) ||
    BOUNCE_SUBJECT.test(subject)
  ) {
    return "bounce";
  }

  const autoSubmitted = headers.get("auto-submitted")?.trim().toLowerCase();
  const precedence = headers.get("precedence")?.trim().toLowerCase();
  if (
    (autoSubmitted && autoSubmitted !== "no") ||
    headers.has("x-autoreply") ||
    headers.has("x-autorespond") ||
    (precedence && ["auto_reply", "bulk", "junk", "list"].includes(precedence)) ||
    AUTO_REPLY_SUBJECT.test(subject)
  ) {
    return "auto_reply";
  }
  return null;
}
