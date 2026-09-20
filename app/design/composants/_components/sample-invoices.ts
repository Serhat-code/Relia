import type { InvoiceStatus } from "@/lib/invoices/status";

export type SampleInvoice = {
  number: string;
  debtor: string;
  dueAt: string;
  amount: number;
  status: InvoiceStatus;
};

/** Données fictives de démonstration. */
export const SAMPLE_INVOICES: readonly SampleInvoice[] = [
  { number: "F-2026-0142", debtor: "Atelier Morel", dueAt: "2026-08-12", amount: 4280, status: "late" },
  { number: "F-2026-0151", debtor: "Studio Brume", dueAt: "2026-09-02", amount: 1250.5, status: "promised" },
  { number: "F-2026-0156", debtor: "Boulangerie Lenoir", dueAt: "2026-09-10", amount: 640, status: "pending" },
  { number: "F-2026-0133", debtor: "Cabinet Vasseur", dueAt: "2026-07-28", amount: 9870, status: "paid" },
  { number: "F-2026-0160", debtor: "Menuiserie Caradec", dueAt: "2026-09-15", amount: 2315.8, status: "disputed" },
  { number: "F-2026-0118", debtor: "Collectif Horizon", dueAt: "2026-07-01", amount: 780, status: "cancelled" },
];
