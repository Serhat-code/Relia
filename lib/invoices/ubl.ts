import { addDays } from "./dates";
import { importRowSchema, type ImportRow } from "./import-row";
import { parseDate } from "./parse";
import { normalizeSiren } from "@/lib/siren";
import { all, amount, attribute, child, hasDoctype, isNode, text, xmlParser } from "./xml";

/**
 * Lecture des factures électroniques en **syntaxe UBL** (norme EN 16931). C'est celle de la plupart
 * des pays de l'Union — le e-Factura roumain, la Croatie, l'Italie par Peppol — là où la France et
 * l'Allemagne emploient CII (Factur-X). Relia lisait déjà CII ; UBL décrit la même facture avec
 * d'autres balises.
 *
 * On ne lit que ce dont la relance a besoin : numéro, client, montants, échéance. Le reste du
 * document est ignoré.
 */

export type UblResult = { ok: true; row: ImportRow; sellerName: string | null } | { ok: false; error: string };

/** Délai de paiement supplétif quand la facture n'indique pas d'échéance. */
const DEFAULT_PAYMENT_DAYS = 30;
/** Identifiant ISO 6523 du SIREN : les autres registres nationaux ne sont pas encore exploités. */
const SIREN_SCHEME = "0002";

const ERRORS = {
  notUbl: "Ce fichier n'est pas une facture électronique UBL.",
  creditNote: "Ce document est un avoir, pas une facture : Relia ne relance que des factures.",
} as const;

/** Date UBL : déjà au format ISO, mais la véracité reste à vérifier (pas de 30 février). */
const ublDate = (node: unknown) => {
  const raw = text(node);
  return raw !== null && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? parseDate(raw) : null;
};

/** Nom légal (BT-44) de préférence, à défaut le nom commercial. */
const partyName = (party: unknown) =>
  text(child(party, "PartyLegalEntity", "RegistrationName")) ?? text(child(party, "PartyName", "Name"));

/** Adresse du client : le contact d'abord, sinon le point d'accès s'il est bien une adresse e-mail. */
function partyEmail(party: unknown): string | null {
  const contact = text(child(party, "Contact", "ElectronicMail"));
  if (contact !== null) return contact;
  const endpoint = child(party, "EndpointID");
  return attribute(endpoint, "schemeID") === "EM" ? text(endpoint) : null;
}

function partySiren(party: unknown): string | null {
  const companyId = child(party, "PartyLegalEntity", "CompanyID");
  const scheme = attribute(companyId, "schemeID");
  const siren = normalizeSiren(text(companyId) ?? "");
  // Sans indication de registre, on n'accepte un SIREN que s'il en a la forme exacte.
  return siren.length === 9 && (scheme === null || scheme === SIREN_SCHEME) ? siren : null;
}

/** Montant de la balise dans la devise du document, à défaut le premier trouvé. */
function amountInCurrency(node: unknown, key: string, currency: string | null): number | null {
  const candidates = all(node, key);
  const match = candidates.find((item) => attribute(item, "currencyID") === currency) ?? candidates[0];
  return amount(match);
}

export function parseUblInvoice(xml: string): UblResult {
  if (hasDoctype(xml)) return { ok: false, error: ERRORS.notUbl };

  let document: unknown;
  try {
    document = xmlParser.parse(xml);
  } catch {
    return { ok: false, error: ERRORS.notUbl };
  }

  // Un avoir a sa propre racine : le dire plutôt que de laisser croire à un fichier illisible.
  if (isNode(child(document, "CreditNote"))) return { ok: false, error: ERRORS.creditNote };

  const invoice = child(document, "Invoice");
  if (!isNode(invoice)) return { ok: false, error: ERRORS.notUbl };

  const buyer = child(invoice, "AccountingCustomerParty", "Party");
  const seller = child(invoice, "AccountingSupplierParty", "Party");
  const totalsNode = child(invoice, "LegalMonetaryTotal");
  const currency = text(child(invoice, "DocumentCurrencyCode"));

  const issuedAt = ublDate(child(invoice, "IssueDate"));
  const totals = {
    taxBasis: amountInCurrency(totalsNode, "TaxExclusiveAmount", currency),
    tax: amountInCurrency(child(invoice, "TaxTotal"), "TaxAmount", currency),
    grandTotal: amountInCurrency(totalsNode, "TaxInclusiveAmount", currency),
    duePayable: amountInCurrency(totalsNode, "PayableAmount", currency),
  };
  const sellerName = partyName(seller);

  const parsed = importRowSchema.safeParse({
    number: text(child(invoice, "ID")) ?? "",
    debtorName: partyName(buyer) ?? "",
    debtorSiren: partySiren(buyer),
    debtorEmail: partyEmail(buyer),
    // La facturation électronique ne concerne que les échanges entre professionnels.
    clientType: "b2b",
    amountHt: totals.taxBasis ?? totals.grandTotal,
    amountTtc: totals.grandTotal,
    currency: currency ?? "EUR",
    issuedAt,
    dueAt: ublDate(child(invoice, "DueDate")) ?? (issuedAt ? addDays(issuedAt, DEFAULT_PAYMENT_DAYS) : null),
    paidAt: null,
    externalId: null,
    facturXRaw: {
      profile: text(child(invoice, "CustomizationID")),
      typeCode: text(child(invoice, "InvoiceTypeCode")),
      seller: { name: sellerName, siren: partySiren(seller) },
      totals,
    },
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue ? `Facture électronique incomplète : ${issue.message}` : ERRORS.notUbl };
  }
  return { ok: true, row: parsed.data, sellerName };
}
