/**
 * CLAUDE.md §2.1 — Relia est un outil de relance, jamais une agence de recouvrement.
 * Ces termes ne doivent apparaître ni dans l'interface, ni dans le marketing,
 * ni dans les e-mails transactionnels. « Recouvrement de créances » est couvert
 * par « recouvrement ».
 *
 * Exception validée le 18/09/2026 : « agences » au pluriel reste autorisé pour
 * désigner la clientèle cible (TPE, PME, freelances et agences). Le singulier,
 * qui pourrait décrire Relia elle-même, reste interdit.
 *
 * Vocabulaire imposé à la place : relance, suivi des règlements, encaissement.
 */
export const FORBIDDEN_UI_TERMS = ["recouvrement", "agence"] as const;

export type ForbiddenUiTerm = (typeof FORBIDDEN_UI_TERMS)[number];

export interface ForbiddenTermMatch {
  term: ForbiddenUiTerm;
  line: number;
  column: number;
  excerpt: string;
}

const EXCERPT_RADIUS = 30;

/** Mot entier uniquement, non précédé ni suivi d'une lettre : « agencement » passe. */
const TERM_PATTERNS: ReadonlyArray<{ term: ForbiddenUiTerm; pattern: RegExp }> = [
  { term: "recouvrement", pattern: /(?<!\p{L})recouvrements?(?!\p{L})/giu },
  { term: "agence", pattern: /(?<!\p{L})agence(?!\p{L})/giu },
];

function excerptAround(line: string, index: number, length: number): string {
  const start = Math.max(0, index - EXCERPT_RADIUS);
  const end = Math.min(line.length, index + length + EXCERPT_RADIUS);
  return line.slice(start, end).trim();
}

export function findForbiddenTerms(text: string): ForbiddenTermMatch[] {
  return text.split(/\r?\n/).flatMap((line, lineIndex) =>
    TERM_PATTERNS.flatMap(({ term, pattern }) =>
      [...line.matchAll(pattern)].map((match) => ({
        term,
        line: lineIndex + 1,
        column: match.index + 1,
        excerpt: excerptAround(line, match.index, match[0].length),
      })),
    ),
  );
}
