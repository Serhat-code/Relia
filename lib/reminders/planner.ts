import { addDays } from "@/lib/invoices/dates";
import type { InvoiceStatus } from "@/lib/invoices/status";
import type { ReminderTone } from "@/lib/templates/system-templates";
import type { Enums } from "@/lib/supabase/database.types";

/**
 * Calcul des relances (§5.3) : quelle étape du scénario préparer, et pour quel jour. Une relance à
 * la fois par facture, dans l'ordre du scénario, avec un délai minimal entre deux envois : une
 * facture importée très en retard commence par le ton courtois, jamais par une mise en demeure.
 */

/** Jours minimum entre deux relances envoyées pour une même facture. */
export const MIN_DAYS_BETWEEN_REMINDERS = 5;
/** Heure d'envoi, à Paris : le matin d'un jour ouvré. */
export const SEND_HOUR = 9;
export const SEND_MINUTE = 30;

export type PlannerStep = { id: string; position: number; offsetDays: number; tone: ReminderTone };
export type PlannerReminder = { stepId: string | null; status: Enums<"reminder_status">; sentAt: string | null };
type PlannerInvoice = { dueAt: string; status: InvoiceStatus };

export const stepDate = (dueAt: string, offsetDays: number) => addDays(dueAt, offsetDays);

/** Samedi et dimanche reportés au lundi (les jours fériés ne sont pas gérés). */
export function nextBusinessDay(date: string): string {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekday === 6) return addDays(date, 2);
  if (weekday === 0) return addDays(date, 1);
  return date;
}

const PARIS_OFFSET = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "longOffset" });

/** Instant UTC d'une heure donnée à Paris ce jour-là (heure d'été comprise). */
export function parisTimeToUtc(date: string, hour: number, minute: number): string {
  const noon = new Date(`${date}T12:00:00Z`);
  const offsetLabel = PARIS_OFFSET.formatToParts(noon).find((part) => part.type === "timeZoneName")?.value ?? "GMT+01:00";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offsetLabel);
  const offsetMinutes = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 60;
  const utc = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), hour, minute);
  return new Date(utc - offsetMinutes * 60_000).toISOString();
}

const OPEN_STATUSES: ReadonlySet<InvoiceStatus> = new Set(["pending", "late"]);
const WAITING: ReadonlySet<PlannerReminder["status"]> = new Set(["scheduled", "awaiting_approval"]);

export type PlannedReminder = { step: PlannerStep; sendOn: string };

export function nextReminder(
  invoice: PlannerInvoice,
  steps: readonly PlannerStep[],
  reminders: readonly PlannerReminder[],
  today: string,
): PlannedReminder | null {
  // Promesse, litige, règlement ou annulation : la séquence est suspendue.
  if (!OPEN_STATUSES.has(invoice.status)) return null;
  if (reminders.some((reminder) => WAITING.has(reminder.status))) return null;

  const sent = reminders.filter((reminder) => reminder.status === "sent");
  const lastSentOn = sent
    .map((reminder) => reminder.sentAt?.slice(0, 10) ?? "")
    .sort()
    .at(-1);
  if (lastSentOn && addDays(lastSentOn, MIN_DAYS_BETWEEN_REMINDERS) > today) return null;

  const doneSteps = new Set(sent.map((reminder) => reminder.stepId));
  const step = [...steps]
    .sort((a, b) => a.position - b.position)
    .find((candidate) => !doneSteps.has(candidate.id));
  if (!step || stepDate(invoice.dueAt, step.offsetDays) > today) return null;

  return { step, sendOn: nextBusinessDay(today) };
}
