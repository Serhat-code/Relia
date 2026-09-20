/**
 * Texte propre d'une réponse : sans le message cité (la relance d'origine), ni la signature.
 * La classification ne doit porter que sur ce que le client a écrit, sinon la relance citée
 * (échéance, montant, « règlement ») fausserait la détection.
 */

/** Débuts de citation des messageries courantes, en français et en anglais. */
const QUOTE_HEADERS: readonly RegExp[] = [
  // Gmail, Apple Mail, Thunderbird : « Le lun. 21 sept. 2026 à 09:30, Atelier <a@b.fr> a écrit : »
  /^\s*Le\s[^\n]{0,200}?(?:\n[^\n]{0,200}?)?a\s+écrit\s*:/im,
  /^\s*On\s[^\n]{0,200}?(?:\n[^\n]{0,200}?)?wrote\s*:/im,
  // Outlook : bloc d'en-têtes « De : … / Envoyé : … »
  /^\s*(?:De|From)\s*:[^\n]*\n\s*(?:Envoyé|Date|Sent)\s*:/im,
  /^\s*-{2,}\s*(?:Message d'origine|Original Message|Message transféré|Forwarded message)/im,
  /^\s*_{10,}\s*$/m,
  // Séparateur de signature normalisé (« -- »)
  /^-- ?$/m,
];

const MAX_REPLY_LENGTH = 4000;

export function stripQuotedReply(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  let end = normalized.length;
  for (const header of QUOTE_HEADERS) {
    const match = header.exec(normalized);
    if (match && match.index < end) end = match.index;
  }
  return normalized
    .slice(0, end)
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_REPLY_LENGTH);
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  ecirc: "ê",
  ocirc: "ô",
  euro: "€",
};

const MAX_CODE_POINT = 0x10ffff;
const fromCodePoint = (value: number) =>
  Number.isInteger(value) && value > 0 && value <= MAX_CODE_POINT ? String.fromCodePoint(value) : "";

/** Texte lisible d'un corps HTML (réponse sans partie texte), sans dépendance. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code: string) => fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => ENTITIES[name.toLowerCase()] ?? entity)
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const EXCERPT_LENGTH = 500;

/** Extrait conservé avec la réponse (minimisation : pas le message entier). */
export function replyExcerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= EXCERPT_LENGTH ? flat : `${flat.slice(0, EXCERPT_LENGTH - 1)}…`;
}
