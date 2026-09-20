/** Statuts d'une facture, identiques à la colonne invoices.status du schéma (CLAUDE.md §4). */
export const INVOICE_STATUSES = ["pending", "late", "promised", "paid", "disputed", "cancelled"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Readonly<Record<InvoiceStatus, string>> = {
  pending: "En attente",
  late: "En retard",
  promised: "Promesse",
  paid: "Payée",
  disputed: "En litige",
  cancelled: "Annulée",
};
