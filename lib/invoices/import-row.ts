import { z } from "zod";
import { isKnownCurrency } from "@/lib/currency";
import { isValidSiren } from "@/lib/siren";
import type { Json } from "@/lib/supabase/database.types";

/** Au-delà, l'import est découpé : une transaction reste courte. */
export const MAX_IMPORT_ROWS = 2000;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const amount = z.number().nonnegative("Montant négatif.").max(100_000_000, "Montant trop élevé.");

/** Totaux du résumé : bornés comme les montants engageants, mais un avoir peut être négatif. */
const nullableAmount = z.number().finite().min(-100_000_000).max(100_000_000).nullable();

/** Résumé conservé d'une facture Factur-X (jamais le PDF) : forme fixe et bornée. */
export const facturXSummarySchema = z
  .object({
    profile: z.string().max(200).nullable(),
    typeCode: z.string().max(10).nullable(),
    seller: z.object({ name: z.string().max(200).nullable(), siren: z.string().regex(/^\d{9}$/).nullable() }).strict(),
    totals: z
      .object({ taxBasis: nullableAmount, tax: nullableAmount, grandTotal: nullableAmount, duePayable: nullableAmount })
      .strict(),
  })
  .strict();

/**
 * Facture prête à importer. Tout ce qui arrive du navigateur (CSV lu côté client, saisie)
 * repasse par ce schéma côté serveur avant d'atteindre la base.
 */
export const importRowSchema = z
  .object({
    number: z.string().trim().min(1, "Numéro de facture manquant.").max(100, "Numéro de facture trop long."),
    debtorName: z.string().trim().min(1, "Nom du client manquant.").max(200, "Nom du client trop long."),
    debtorSiren: z.string().refine(isValidSiren, "SIREN du client invalide.").nullable(),
    debtorEmail: z.email("E-mail du client invalide.").nullable(),
    clientType: z.enum(["b2b", "b2c"], { error: "Type de client (B2B/B2C) manquant." }),
    amountHt: amount,
    amountTtc: amount,
    currency: z
      .string()
      .refine((code) => isKnownCurrency(code), "Devise inconnue : indiquez un code à 3 lettres, par exemple EUR."),
    issuedAt: isoDate,
    dueAt: isoDate,
    paidAt: isoDate.nullable(),
    externalId: z.string().max(200).nullable(),
    facturXRaw: facturXSummarySchema.nullable(),
  })
  .refine((row) => row.amountTtc >= row.amountHt, {
    message: "Le montant TTC est inférieur au montant HT.",
    path: ["amountTtc"],
  })
  .refine((row) => row.dueAt >= row.issuedAt, {
    message: "L'échéance précède la date d'émission.",
    path: ["dueAt"],
  });

export type ImportRow = z.infer<typeof importRowSchema>;

export const importBatchSchema = z
  .array(importRowSchema)
  .min(1, "Aucune facture à importer.")
  .max(MAX_IMPORT_ROWS, `${MAX_IMPORT_ROWS} factures au maximum par import.`);

/** Format attendu par la fonction SQL public.import_invoices (colonnes en snake_case). */
export function toRpcRow(row: ImportRow): { [key: string]: Json } {
  return {
    number: row.number,
    debtor_name: row.debtorName,
    debtor_siren: row.debtorSiren,
    debtor_email: row.debtorEmail,
    client_type: row.clientType,
    amount_ht: row.amountHt,
    amount_ttc: row.amountTtc,
    currency: row.currency,
    issued_at: row.issuedAt,
    due_at: row.dueAt,
    paid_at: row.paidAt,
    external_id: row.externalId,
    factur_x_raw: row.facturXRaw as Json,
  };
}
