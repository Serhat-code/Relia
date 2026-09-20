import { randomUUID } from "node:crypto";

/**
 * Identifiants de message (RFC 5322 « Message-ID »). Une relance envoyée en SMTP porte un identifiant
 * choisi par Relia, sous le domaine de l'expéditeur : les réponses le citent (In-Reply-To, References),
 * ce qui permet de les rattacher à la relance en lisant la boîte IMAP du client.
 */

export function newMessageId(fromAddress: string): string {
  const domain = fromAddress.split("@")[1]?.toLowerCase() || "localhost";
  return `<${randomUUID()}@${domain}>`;
}

/** Forme comparable d'un identifiant : sans chevrons ni espaces, en minuscules. */
export function normalizeMessageId(value: string): string {
  return value.trim().replace(/^<|>$/g, "").trim().toLowerCase();
}

/** Identifiants cités par un en-tête References ou In-Reply-To (liste séparée par des espaces). */
export function parseMessageIdList(value: string | readonly string[] | null | undefined): string[] {
  if (!value) return [];
  const raw = typeof value === "string" ? [value] : value;
  return raw
    .flatMap((entry) => entry.match(/<[^<>\s]+>/g) ?? (entry.trim() ? [entry] : []))
    .map(normalizeMessageId)
    .filter(Boolean);
}
