import type { InvoiceStatus } from "./status";

/** Dates au format ISO (AAAA-MM-JJ), toujours au fuseau de Paris : c'est là que vivent les échéances. */
const PARIS_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DAY_MS = 86_400_000;

export function todayInParis(now: Date = new Date()): string {
  return PARIS_DAY.format(now);
}

export function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Statut à afficher : une facture « en attente » dont l'échéance est passée est en retard,
 * même si le calcul quotidien (cron) ne l'a pas encore marquée.
 */
export function effectiveStatus(status: InvoiceStatus, dueAt: string, today: string): InvoiceStatus {
  return status === "pending" && dueAt < today ? "late" : status;
}

export function daysOverdue(dueAt: string, today: string): number {
  const days = Math.round((Date.parse(today) - Date.parse(dueAt)) / DAY_MS);
  return Math.max(0, days);
}

/** Au plus une semaine avant l'échéance, elle est signalée comme proche. */
const SOON_THRESHOLD_DAYS = 7;

export type DueDescription = { tone: "late" | "soon" | "future"; text: string };

/** Échéance d'une facture ouverte, en mots : « 18 jours de retard », « demain », « dans 12 jours ». */
export function describeDue(dueAt: string, today: string): DueDescription {
  const days = Math.round((Date.parse(dueAt) - Date.parse(today)) / DAY_MS);
  if (days < 0) {
    const late = -days;
    return { tone: "late", text: `${late} ${late >= 2 ? "jours" : "jour"} de retard` };
  }
  if (days === 0) return { tone: "soon", text: "échéance aujourd'hui" };
  if (days === 1) return { tone: "soon", text: "demain" };
  return { tone: days <= SOON_THRESHOLD_DAYS ? "soon" : "future", text: `dans ${days} jours` };
}
