"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { changeInvoiceStatus, importInvoices, type ImportSummary } from "@/lib/data/invoices";
import { isRateLimited, RATE_LIMITS } from "@/lib/data/rate-limit";
import { requireMember } from "@/lib/data/session";
import { readForm, type FormState } from "@/lib/forms/form-state";
import { importBatchSchema } from "@/lib/invoices/import-row";
import { MANUAL_INVOICE_FIELDS, parseManualInvoice } from "@/lib/invoices/manual-form";

/** Mutations des factures. Chaque action vérifie la session : une Server Action est un point d'entrée public. */

function refreshInvoicePages(invoiceId?: string) {
  revalidatePath("/app/factures");
  revalidatePath("/app");
  if (invoiceId) revalidatePath(`/app/factures/${invoiceId}`);
}

export async function createInvoiceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireMember();
  const values = readForm(formData, MANUAL_INVOICE_FIELDS);
  const parsed = parseManualInvoice(values);
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors, values };

  const result = await importInvoices([parsed.row], "manual");
  if (!result.ok) return { status: "error", message: result.error, values };

  const [invoiceId] = result.value.invoiceIds;
  if (!invoiceId) {
    return { status: "error", fieldErrors: { number: "Une facture porte déjà ce numéro." }, values };
  }
  refreshInvoicePages();
  redirect(`/app/factures/${invoiceId}?creee=1`);
}

const importInputSchema = z.object({
  source: z.enum(["csv", "facturx"]),
  rows: importBatchSchema,
});

export type ImportActionResult = { ok: true; summary: ImportSummary } | { ok: false; error: string };

/** Lignes déjà lues et vérifiées dans le navigateur ; elles sont revalidées ici avant l'import. */
export async function importInvoicesAction(input: unknown): Promise<ImportActionResult> {
  const member = await requireMember();
  if (await isRateLimited(member.organization.id, RATE_LIMITS.bulkImport)) {
    return { ok: false, error: "Beaucoup d'imports en peu de temps : réessayez dans une dizaine de minutes." };
  }
  const parsed = importInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données d'import invalides." };
  }

  const result = await importInvoices(parsed.data.rows, parsed.data.source);
  if (!result.ok) return result;
  refreshInvoicePages();
  return { ok: true, summary: result.value };
}

const statusInputSchema = z.object({
  invoiceId: z.uuid(),
  action: z.enum(["mark_paid", "mark_disputed", "cancel", "reopen"]),
  paidAt: z.iso.date().nullable().default(null),
});

export type StatusActionResult = { ok: true } | { ok: false; error: string };

export async function changeInvoiceStatusAction(input: unknown): Promise<StatusActionResult> {
  await requireMember();
  const parsed = statusInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };

  const { invoiceId, action, paidAt } = parsed.data;
  const result = await changeInvoiceStatus(invoiceId, action, paidAt);
  if (!result.ok) return result;
  refreshInvoicePages(invoiceId);
  return { ok: true };
}
