import { firstFieldErrors } from "@/lib/forms/form-state";
import { normalizeSiren } from "@/lib/siren";
import { importRowSchema, type ImportRow } from "./import-row";
import { parseAmount, parseDate } from "./parse";

/** Champs du formulaire de saisie manuelle, dans l'ordre de l'écran. */
export const MANUAL_INVOICE_FIELDS = [
  "number",
  "debtorName",
  "clientType",
  "debtorSiren",
  "debtorEmail",
  "amountHt",
  "amountTtc",
  "issuedAt",
  "dueAt",
] as const;

type ManualField = (typeof MANUAL_INVOICE_FIELDS)[number];
type Values = Partial<Record<ManualField, string>>;

export type ManualInvoiceResult = { ok: true; row: ImportRow } | { ok: false; fieldErrors: Record<string, string> };

const REQUIRED_MESSAGES: Partial<Record<ManualField, string>> = {
  number: "Indiquez le numéro de la facture.",
  debtorName: "Indiquez le nom du client.",
  clientType: "Précisez s'il s'agit d'un professionnel ou d'un particulier.",
  amountTtc: "Indiquez le montant TTC.",
  issuedAt: "Indiquez la date d'émission.",
  dueAt: "Indiquez l'échéance.",
};

export function parseManualInvoice(raw: Values): ManualInvoiceResult {
  const value = (field: ManualField) => (raw[field] ?? "").trim();
  const missing = Object.entries(REQUIRED_MESSAGES).filter(([field]) => value(field as ManualField) === "");
  if (missing.length > 0) return { ok: false, fieldErrors: Object.fromEntries(missing) };

  const amountTtc = parseAmount(value("amountTtc"));
  const amountHt = value("amountHt") === "" ? amountTtc : parseAmount(value("amountHt"));
  const unreadable = [
    ["amountTtc", amountTtc] as const,
    ["amountHt", amountHt] as const,
  ].filter(([, amount]) => amount === null);
  if (unreadable.length > 0) {
    return {
      ok: false,
      fieldErrors: Object.fromEntries(unreadable.map(([field]) => [field, `Montant illisible : « ${value(field)} ».`])),
    };
  }

  const siren = normalizeSiren(value("debtorSiren"));
  const parsed = importRowSchema.safeParse({
    number: value("number"),
    debtorName: value("debtorName"),
    debtorSiren: siren === "" ? null : siren,
    debtorEmail: value("debtorEmail") || null,
    clientType: value("clientType"),
    amountHt,
    amountTtc,
    currency: "EUR",
    issuedAt: parseDate(value("issuedAt")) ?? value("issuedAt"),
    dueAt: parseDate(value("dueAt")) ?? value("dueAt"),
    paidAt: null,
    externalId: null,
    facturXRaw: null,
  });
  return parsed.success ? { ok: true, row: parsed.data } : { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
}
