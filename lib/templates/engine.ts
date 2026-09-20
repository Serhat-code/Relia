import type { ClientType } from "@/lib/debtors/client-type";
import { formatCurrency, formatDate, formatDays } from "@/lib/format";
import { daysOverdue } from "@/lib/invoices/dates";

/**
 * Moteur de modèles de relance : remplace les variables {{nom}} par les données de la facture.
 * Refuse un modèle dont le type de client diffère de celui du débiteur (§2.5) et toute variable
 * inconnue (mieux vaut ne rien envoyer qu'un message à trous).
 */

export const TEMPLATE_VARIABLES = {
  salutation: { label: "Formule d'appel", example: "Bonjour Yann Caradec," },
  nom_client: { label: "Nom du client", example: "Menuiserie Caradec & Fils" },
  numero_facture: { label: "Numéro de facture", example: "F-2026-042" },
  montant: { label: "Montant TTC", example: "1 200,00 €" },
  date_emission: { label: "Date d'émission", example: "01/08/2026" },
  date_echeance: { label: "Date d'échéance", example: "31/08/2026" },
  statut_echeance: { label: "Échéance (passée ou à venir)", example: "est arrivée à échéance le 31/08/2026" },
  retard: { label: "Retard", example: "18 jours" },
  nom_entreprise: { label: "Votre entreprise", example: "Atelier Démo" },
} as const;

export type TemplateVariable = keyof typeof TEMPLATE_VARIABLES;

export type RenderContext = {
  debtor: { clientType: ClientType; name: string; contactName: string | null };
  invoice: { number: string; amountTtc: number; currency: string; issuedAt: string; dueAt: string };
  organizationName: string;
  /** Date du jour (Paris), AAAA-MM-JJ. */
  today: string;
};

export type RenderableTemplate = { clientType: ClientType; subject: string; bodyMarkdown: string };

export type RenderResult =
  | { ok: true; subject: string; bodyMarkdown: string; bodyText: string; bodyHtml: string }
  | { ok: false; error: string };

const VARIABLE_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g;

export function extractVariables(text: string): string[] {
  return [...new Set([...text.matchAll(VARIABLE_PATTERN)].map((match) => match[1] ?? ""))];
}

const isKnownVariable = (name: string): name is TemplateVariable => Object.hasOwn(TEMPLATE_VARIABLES, name);

export function variableValues({ debtor, invoice, organizationName, today }: RenderContext): Record<TemplateVariable, string> {
  const contact = debtor.contactName?.trim();
  const late = daysOverdue(invoice.dueAt, today);
  const dueDate = formatDate(invoice.dueAt);
  return {
    salutation: contact ? `Bonjour ${contact},` : "Bonjour,",
    nom_client: debtor.name,
    numero_facture: invoice.number,
    montant: formatCurrency(invoice.amountTtc, invoice.currency),
    date_emission: formatDate(invoice.issuedAt),
    date_echeance: dueDate,
    statut_echeance: invoice.dueAt < today ? `est arrivée à échéance le ${dueDate}` : `arrive à échéance le ${dueDate}`,
    retard: late > 0 ? formatDays(late) : "aucun retard",
    nom_entreprise: organizationName,
  };
}

function fill(text: string, values: Record<TemplateVariable, string>): string {
  return text.replace(VARIABLE_PATTERN, (_match, name: string) => (isKnownVariable(name) ? values[name] : ""));
}

const CLIENT_TYPE_MISMATCH: Readonly<Record<ClientType, string>> = {
  b2b: "Un modèle pour professionnels ne peut pas être envoyé à un particulier.",
  b2c: "Un modèle pour particuliers ne s'utilise pas avec un professionnel.",
};

export function renderTemplate(template: RenderableTemplate, context: RenderContext): RenderResult {
  if (template.clientType !== context.debtor.clientType) {
    return { ok: false, error: CLIENT_TYPE_MISMATCH[template.clientType] };
  }
  const unknown = extractVariables(`${template.subject}\n${template.bodyMarkdown}`).find((name) => !isKnownVariable(name));
  if (unknown) return { ok: false, error: `Variable inconnue : {{${unknown}}}.` };

  const values = variableValues(context);
  const bodyMarkdown = fill(template.bodyMarkdown, values);
  return {
    ok: true,
    // Un objet d'e-mail tient sur une ligne.
    subject: fill(template.subject, values).replace(/\s+/g, " ").trim(),
    bodyMarkdown,
    bodyText: bodyMarkdown.replace(/\*\*(.+?)\*\*/g, "$1"),
    bodyHtml: markdownToHtml(bodyMarkdown),
  };
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Markdown minimal des modèles : paragraphes, retours à la ligne et **gras**. Tout HTML saisi est échappé. */
export function markdownToHtml(markdown: string): string {
  return markdown
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const html = escapeHtml(paragraph.trim())
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
      return `<p>${html}</p>`;
    })
    .join("\n");
}
