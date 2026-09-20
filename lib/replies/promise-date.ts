import { addDays } from "@/lib/invoices/dates";

/**
 * Date de règlement annoncée dans une réponse en français : « le 30/09 », « le 2 octobre »,
 * « vendredi », « sous huitaine », « fin du mois »… La première date plausible du texte est
 * retenue : pas dans le passé, et à moins de quatre mois (au-delà, ce n'est plus une promesse
 * à suivre automatiquement).
 */

export const MAX_PROMISE_HORIZON_DAYS = 120;

const MONTHS: readonly [RegExp, number][] = [
  [/^janv/, 1],
  [/^f[ée]v/, 2],
  [/^mars/, 3],
  [/^avr/, 4],
  [/^mai/, 5],
  [/^juin/, 6],
  [/^juil/, 7],
  [/^ao[uû]t/, 8],
  [/^sept?/, 9],
  [/^oct/, 10],
  [/^nov/, 11],
  [/^d[ée]c/, 12],
];

const MONTH_PATTERN =
  "janv(?:ier)?|f[ée]vr?(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|ao[uû]t|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?";

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;
const FRIDAY = 5;

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  dix: 10,
  quinze: 15,
  trente: 30,
};

const pad = (value: number) => String(value).padStart(2, "0");

function realDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const weekday = (isoDate: string) => new Date(`${isoDate}T12:00:00Z`).getUTCDay();
const yearOf = (isoDate: string) => Number(isoDate.slice(0, 4));
const monthOf = (isoDate: string) => Number(isoDate.slice(5, 7));

function lastDayOfMonth(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

/** Jour et mois sans année : l'occurrence à venir (cette année, sinon la suivante). */
function upcoming(day: number, month: number, from: string, explicitYear?: number): string | null {
  if (explicitYear) return realDate(explicitYear, month, day);
  const thisYear = realDate(yearOf(from), month, day);
  if (thisYear && thisYear >= from) return thisYear;
  return realDate(yearOf(from) + 1, month, day);
}

/** Prochain jour de la semaine donné, strictement après la date de départ. */
function nextWeekday(from: string, target: number): string {
  const delta = (target - weekday(from) + 7) % 7 || 7;
  return addDays(from, delta);
}

/** Vendredi de la semaine en cours (celui de la semaine suivante si on est déjà vendredi ou après). */
function endOfWeek(from: string): string {
  const day = weekday(from);
  return day >= 1 && day < FRIDAY ? addDays(from, FRIDAY - day) : nextWeekday(from, FRIDAY);
}

function monthNumber(word: string): number | null {
  return MONTHS.find(([pattern]) => pattern.test(word))?.[1] ?? null;
}

function expandYear(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const year = Number(raw);
  return year < 100 ? 2000 + year : year;
}

type Candidate = { index: number; date: string | null; label: string };

type Rule = { pattern: RegExp; resolve: (match: RegExpExecArray, from: string) => string | null };

const RULES: readonly Rule[] = [
  {
    pattern: /\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}|\d{2}))?\b/g,
    resolve: (m, from) => upcoming(Number(m[1]), Number(m[2]), from, expandYear(m[3])),
  },
  {
    // Limite de mot après le mois : « 2 mais » n'est pas « 2 mai ».
    pattern: new RegExp(`\\b(\\d{1,2})(?:er)?\\s+(${MONTH_PATTERN})\\b\\.?(?:\\s+(\\d{4}))?`, "g"),
    resolve: (m, from) => {
      const month = monthNumber(m[2] ?? "");
      return month ? upcoming(Number(m[1]), month, from, expandYear(m[3])) : null;
    },
  },
  { pattern: /\bapr[èe]s[- ]demain\b/g, resolve: (_, from) => addDays(from, 2) },
  { pattern: /(?<!apr[èe]s[- ])\bdemain\b/g, resolve: (_, from) => addDays(from, 1) },
  { pattern: /\baujourd'hui\b/g, resolve: (_, from) => from },
  {
    pattern: /\b(?:dans|sous|d'ici)\s+(\d{1,2}|deux|trois|quatre|cinq|six|sept|huit|dix|quinze|trente)\s+jours?\b/g,
    resolve: (m, from) => {
      const raw = m[1] ?? "";
      const days = NUMBER_WORDS[raw] ?? Number(raw);
      return Number.isFinite(days) ? addDays(from, days) : null;
    },
  },
  { pattern: /\bsous\s+huitaine\b/g, resolve: (_, from) => addDays(from, 8) },
  { pattern: /\bsous\s+quinzaine\b/g, resolve: (_, from) => addDays(from, 15) },
  { pattern: /\bsemaine\s+prochaine\b/g, resolve: (_, from) => addDays(endOfWeek(from), 7) },
  { pattern: /\bfin\s+de\s+(?:la\s+)?semaine\b/g, resolve: (_, from) => endOfWeek(from) },
  {
    pattern: /\bfin\s+(?:du\s+|de\s+)?mois\b/g,
    resolve: (_, from) => lastDayOfMonth(yearOf(from), monthOf(from)),
  },
  {
    pattern: new RegExp(`\\bfin\\s+(?:d')?(${MONTH_PATTERN})\\b`, "g"),
    resolve: (m, from) => {
      const month = monthNumber(m[1] ?? "");
      if (!month) return null;
      const year = month < monthOf(from) ? yearOf(from) + 1 : yearOf(from);
      return lastDayOfMonth(year, month);
    },
  },
  {
    pattern: /\bd[ée]but\s+(?:du\s+)?mois\s+prochain\b/g,
    resolve: (_, from) => {
      const month = monthOf(from) === 12 ? 1 : monthOf(from) + 1;
      return realDate(month === 1 ? yearOf(from) + 1 : yearOf(from), month, 5);
    },
  },
  {
    // « vendredi 30 septembre » : c'est la date explicite qui compte.
    pattern: /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b(?!\s+\d)/g,
    resolve: (m, from) => nextWeekday(from, WEEKDAYS.indexOf((m[1] ?? "") as (typeof WEEKDAYS)[number])),
  },
];

export type PromisedDate = { date: string; label: string };

export function findPromisedDate(text: string, receivedOn: string): PromisedDate | null {
  const lowered = text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");
  const latest = addDays(receivedOn, MAX_PROMISE_HORIZON_DAYS);
  const candidates: Candidate[] = [];

  for (const rule of RULES) {
    for (const match of lowered.matchAll(rule.pattern)) {
      candidates.push({ index: match.index, date: rule.resolve(match as RegExpExecArray, receivedOn), label: match[0] });
    }
  }

  const plausible = candidates
    .filter((candidate): candidate is Candidate & { date: string } =>
      candidate.date !== null && candidate.date >= receivedOn && candidate.date <= latest,
    )
    .sort((a, b) => a.index - b.index);
  const first = plausible[0];
  return first ? { date: first.date, label: first.label.trim() } : null;
}
