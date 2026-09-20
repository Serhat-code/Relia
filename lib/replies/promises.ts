import { z } from "zod";
import { addDays } from "@/lib/invoices/dates";
import { parseAmount, parseDate } from "@/lib/invoices/parse";

/**
 * Promesses de règlement. Une facture sous promesse n'est plus relancée jusqu'à la date promise,
 * plus un délai de grâce (le virement peut mettre quelques jours) ; ensuite, sans règlement, la
 * promesse est non tenue et les relances reprennent.
 */

/** Même valeur que private.promise_grace_days() en base (parité vérifiée par test). */
export const PROMISE_GRACE_DAYS = 3;

/** Au-delà d'un an, ce n'est plus une promesse à suivre : la base refuse aussi. */
export const MAX_MANUAL_PROMISE_DAYS = 365;

/** Dernier jour où le règlement compte comme tenu. */
export const promiseDeadline = (promisedDate: string) => addDays(promisedDate, PROMISE_GRACE_DAYS);

export type PromiseInput = { promisedDate: string; promisedAmount: number | null };

type PromiseFormResult = { ok: true; value: PromiseInput } | { ok: false; error: string };

const formSchema = z.object({ promisedDate: z.string().trim(), promisedAmount: z.string().trim() });

/** Promesse saisie par un membre : date à venir (un an au plus), montant facultatif, jamais au-delà de la facture. */
export function parsePromiseForm(input: unknown, today: string, invoiceAmount: number): PromiseFormResult {
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Promesse invalide." };
  const { promisedDate, promisedAmount } = parsed.data;

  // Date réelle du calendrier, au format ISO du champ date (« 2026-02-30 » est refusée).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(promisedDate) || parseDate(promisedDate) !== promisedDate) {
    return { ok: false, error: "Indiquez la date promise." };
  }
  if (promisedDate < today) return { ok: false, error: "La date promise ne peut pas être passée." };
  if (promisedDate > addDays(today, MAX_MANUAL_PROMISE_DAYS)) {
    return { ok: false, error: "La date promise doit être dans l'année qui vient." };
  }
  if (promisedAmount === "") return { ok: true, value: { promisedDate, promisedAmount: null } };

  const amount = parseAmount(promisedAmount);
  if (amount === null || amount <= 0) return { ok: false, error: "Montant invalide." };
  if (amount > invoiceAmount) return { ok: false, error: "Le montant promis dépasse celui de la facture." };
  return { ok: true, value: { promisedDate, promisedAmount: amount } };
}
