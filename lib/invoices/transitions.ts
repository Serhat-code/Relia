import { effectiveStatus } from "./dates";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "./status";

/**
 * Changements de statut à la main. « En retard » se déduit de l'échéance, « promesse » des
 * promesses de paiement : ce ne sont pas des actions. Toute facture qui quitte le cycle de
 * relance (payée, contestée, annulée) voit ses relances en attente annulées par la base.
 */
export type StatusAction = "mark_paid" | "mark_disputed" | "cancel" | "reopen";

const ALLOWED_FROM: Readonly<Record<StatusAction, readonly InvoiceStatus[]>> = {
  mark_paid: ["pending", "late", "promised", "disputed"],
  mark_disputed: ["pending", "late", "promised"],
  cancel: ["pending", "late", "promised", "disputed"],
  reopen: ["paid", "disputed", "cancelled"],
};

const ACTION_ORDER: readonly StatusAction[] = ["mark_paid", "mark_disputed", "cancel", "reopen"];

export const STATUS_ACTION_LABELS: Readonly<Record<StatusAction, string>> = {
  mark_paid: "Marquer comme payée",
  mark_disputed: "Signaler un litige",
  cancel: "Annuler la facture",
  reopen: "Rouvrir la facture",
};

export function availableActions(status: InvoiceStatus): StatusAction[] {
  return ACTION_ORDER.filter((action) => ALLOWED_FROM[action].includes(status));
}

type InvoiceState = { status: InvoiceStatus; dueAt: string };
export type StatusChange = { ok: true; status: InvoiceStatus; paidAt: string | null } | { ok: false; error: string };

export function nextStatus(action: StatusAction, invoice: InvoiceState, today: string, paidAt: string | null = null): StatusChange {
  if (!ALLOWED_FROM[action].includes(invoice.status)) {
    return { ok: false, error: `Cette action n'est pas possible pour une facture « ${INVOICE_STATUS_LABELS[invoice.status]} ».` };
  }

  switch (action) {
    case "mark_paid":
      if (!paidAt) return { ok: false, error: "Indiquez la date du règlement." };
      if (paidAt > today) return { ok: false, error: "La date du règlement ne peut pas être dans le futur." };
      return { ok: true, status: "paid", paidAt };
    case "mark_disputed":
      return { ok: true, status: "disputed", paidAt: null };
    case "cancel":
      return { ok: true, status: "cancelled", paidAt: null };
    case "reopen":
      return { ok: true, status: effectiveStatus("pending", invoice.dueAt, today), paidAt: null };
  }
}
