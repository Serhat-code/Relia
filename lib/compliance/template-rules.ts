import type { ClientType } from "@/lib/debtors/client-type";
import { findForbiddenTerms } from "./forbidden-terms";

/**
 * Règles de contenu des modèles de relance, vérifiées à l'enregistrement (et par la base,
 * `private.template_violations`, qui reprend les mêmes motifs — parité testée).
 *
 * §2.6 : aucune menace. Le client ne peut pas mettre ces actions à exécution, et menacer d'une
 * action qu'on ne peut pas engager est une pratique prohibée. Le plus ferme autorisé est une mise
 * en demeure factuelle : montant, échéance dépassée, délai demandé, et le simple fait que le
 * dossier pourra être confié à un tiers (sans date, sans nom de tiers, sans menace chiffrée).
 *
 * §2.5 : l'indemnité forfaitaire de 40 € et les pénalités de retard relèvent du Code de commerce,
 * entre professionnels seulement. Un modèle pour particuliers ne les mentionne jamais.
 */

export type ContentRule = { label: string; pattern: RegExp; example: string };

// Mot entier : ni précédé ni suivi d'une lettre (« saisissez » ne déclenche pas « saisie »).
const word = (source: string) => new RegExp(`(?<!\\p{L})(?:${source})(?!\\p{L})`, "iu");

export const THREAT_TERMS: readonly ContentRule[] = [
  { label: "saisie", pattern: word("saisi(?:e|es|s|r|rons|ra|ront)?"), example: "Nous procéderons à une saisie." },
  { label: "huissier", pattern: word("huissiers?"), example: "Un huissier sera mandaté." },
  { label: "commissaire de justice", pattern: word("commissaires? de justice"), example: "Un commissaire de justice." },
  { label: "procédure judiciaire", pattern: word("proc[ée]dures? judiciaires?"), example: "Une procédure judiciaire." },
  { label: "poursuites", pattern: word("poursuites(?: judiciaires)?|poursuite judiciaire"), example: "Des poursuites." },
  { label: "injonction de payer", pattern: word("injonctions? de payer"), example: "Une injonction de payer." },
  { label: "fichage", pattern: word("fich(?:age|er|é|ée|és|ées)"), example: "Vous serez fiché." },
  { label: "mise en recouvrement", pattern: word("mises? en recouvrement"), example: "Une mise en recouvrement." },
  { label: "tribunal", pattern: word("tribuna(?:l|ux)"), example: "Le tribunal sera saisi." },
  { label: "avocat", pattern: word("avocats?"), example: "Notre avocat vous écrira." },
  { label: "contentieux", pattern: word("contentieux"), example: "Le service contentieux." },
  { label: "plainte", pattern: word("plaintes?"), example: "Nous porterons plainte." },
];

export const B2C_FORBIDDEN_MENTIONS: readonly ContentRule[] = [
  { label: "indemnité forfaitaire", pattern: word("indemnit[ée]s? forfaitaires?"), example: "Une indemnité forfaitaire." },
  { label: "40 €", pattern: /(?<!\d)40(?:,00)?\s?(?:€|euros?)(?!\p{L})/iu, example: "Une somme de 40 €." },
  { label: "pénalités de retard", pattern: word("p[ée]nalit[ée]s? de retard"), example: "Des pénalités de retard." },
  {
    label: "intérêts de retard",
    pattern: word("int[ée]r[êe]ts? (?:de retard|moratoires?)"),
    example: "Des intérêts de retard.",
  },
  { label: "taux de la BCE", pattern: word("BCE|banque centrale europ[ée]enne"), example: "Au taux de la BCE." },
  { label: "article L441", pattern: word("L\\.? ?441(?:-\\d+)?"), example: "Article L441-10." },
  { label: "Code de commerce", pattern: word("code de commerce"), example: "Selon le Code de commerce." },
];

type TemplateContent = { clientType: ClientType; subject: string; body: string };

/**
 * Texte comparé aux règles : caractères invisibles retirés (espace sans chasse, trait d'union
 * conditionnel…) et toute espace Unicode ou fin de ligne ramenée à une espace simple. Un texte
 * collé depuis un traitement de texte (espaces insécables) ne contourne donc pas la liste.
 * Même normalisation que private.template_violations.
 */
export function normalizeForRules(text: string): string {
  return text.replace(/\p{Cf}/gu, "").replace(/\s+/gu, " ");
}

/** Phrases d'erreur en français, une par règle enfreinte ; tableau vide si le modèle est conforme. */
export function findTemplateViolations({ clientType, subject, body }: TemplateContent): string[] {
  const text = normalizeForRules(`${subject}\n${body}`);
  const threats = THREAT_TERMS.filter((rule) => rule.pattern.test(text)).map(
    (rule) => `« ${rule.label} » : menace interdite dans une relance.`,
  );
  const reserved =
    clientType === "b2c"
      ? B2C_FORBIDDEN_MENTIONS.filter((rule) => rule.pattern.test(text)).map(
          (rule) => `« ${rule.label} » : réservé aux professionnels, jamais pour un particulier.`,
        )
      : [];
  const uiTerms = [...new Set(findForbiddenTerms(text).map((match) => match.term))]
    // « mise en recouvrement » est déjà signalée comme menace.
    .filter((term) => !(term === "recouvrement" && threats.some((threat) => threat.includes("recouvrement"))))
    .map((term) => `« ${term} » : terme interdit dans les messages de Relia.`);

  return [...threats, ...reserved, ...uiTerms];
}
