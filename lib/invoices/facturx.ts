import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFString } from "pdf-lib";
import { isValidSiren, normalizeSiren } from "@/lib/siren";
import { addDays } from "./dates";
import { importRowSchema, type ImportRow } from "./import-row";
import { parseDate } from "./parse";
import { all, amount, attribute, child, hasDoctype, isNode, text, xmlParser } from "./xml";

/**
 * Lecture des factures électroniques Factur-X : un PDF/A-3 qui embarque la facture structurée
 * en XML (syntaxe CII). On ne lit que le XML, jamais le rendu PDF.
 */

export const MAX_FACTURX_BYTES = 10 * 1024 * 1024;

/** Délai de paiement supplétif (C. com. L441-10) quand la facture n'indique pas d'échéance. */
const DEFAULT_PAYMENT_DAYS = 30;
/** Identifiant ISO 6523 du SIREN dans les factures électroniques françaises. */
const SIREN_SCHEME = "0002";
const MAX_NAME_TREE_DEPTH = 8;
/** Noms usuels du XML embarqué : Factur-X, puis ses équivalents allemands. */
const PREFERRED_ATTACHMENTS = ["factur-x.xml", "zugferd-invoice.xml", "xrechnung.xml"];

const ERRORS = {
  notCii: "Ce fichier n'est pas une facture Factur-X (syntaxe CII).",
  noXml: "Ce PDF ne contient pas de facture électronique Factur-X.",
  badPdf: "Ce fichier PDF est illisible ou endommagé.",
  tooLarge: "Ce fichier dépasse 10 Mo.",
} as const;

export type FacturXResult = { ok: true; row: ImportRow; sellerName: string | null } | { ok: false; error: string };

/** Date CII au format 102 (AAAAMMJJ). */
function ciiDate(node: unknown): string | null {
  const dateNode = child(node, "DateTimeString");
  const raw = text(dateNode);
  const format = attribute(dateNode, "format");
  if (raw === null || (format !== null && format !== "102") || !/^\d{8}$/.test(raw)) return null;
  // parseDate vérifie que la date existe (pas de 30 février).
  return parseDate(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`);
}

function buyerSiren(buyer: unknown): string | null {
  const legalId = child(buyer, "SpecifiedLegalOrganization", "ID");
  const scheme = attribute(legalId, "schemeID");
  const siren = normalizeSiren(text(legalId) ?? "").slice(0, 9);
  // Clé de contrôle vérifiée ici : un SIREN mal saisi par l'émetteur est ignoré, plutôt que de
  // faire échouer toute la facture au moment de la revalidation.
  return (scheme === null || scheme === SIREN_SCHEME) && isValidSiren(siren) ? siren : null;
}

function taxTotal(settlement: unknown, currency: string | null): number | null {
  const summation = child(settlement, "SpecifiedTradeSettlementHeaderMonetarySummation");
  const totals = all(summation, "TaxTotalAmount");
  const inInvoiceCurrency = totals.find((total) => attribute(total, "currencyID") === currency) ?? totals[0];
  return amount(inInvoiceCurrency);
}

/** Lit une facture CII (le XML d'un Factur-X) et la ramène au format d'import de Relia. */
export function parseCiiInvoice(xml: string): FacturXResult {
  // Une facture CII n'a jamais de DOCTYPE : on refuse d'emblée les entités déclarées (expansion).
  if (hasDoctype(xml)) return { ok: false, error: ERRORS.notCii };

  let document: unknown;
  try {
    document = xmlParser.parse(xml);
  } catch {
    return { ok: false, error: ERRORS.notCii };
  }

  const invoice = child(document, "CrossIndustryInvoice");
  const header = child(invoice, "ExchangedDocument");
  const transaction = child(invoice, "SupplyChainTradeTransaction");
  if (!isNode(header) || !isNode(transaction)) return { ok: false, error: ERRORS.notCii };

  const agreement = child(transaction, "ApplicableHeaderTradeAgreement");
  const settlement = child(transaction, "ApplicableHeaderTradeSettlement");
  const summation = child(settlement, "SpecifiedTradeSettlementHeaderMonetarySummation");
  const buyer = child(agreement, "BuyerTradeParty");
  const seller = child(agreement, "SellerTradeParty");

  const currency = text(child(settlement, "InvoiceCurrencyCode"));
  const issuedAt = ciiDate(child(header, "IssueDateTime"));
  const dueAt = ciiDate(child(settlement, "SpecifiedTradePaymentTerms", "DueDateDateTime"));
  const totals = {
    taxBasis: amount(child(summation, "TaxBasisTotalAmount")),
    tax: taxTotal(settlement, currency),
    grandTotal: amount(child(summation, "GrandTotalAmount")),
    duePayable: amount(child(summation, "DuePayableAmount")),
  };
  const sellerName = text(child(seller, "Name"));
  const email = child(buyer, "URIUniversalCommunication", "URIID");
  const siren = buyerSiren(buyer);

  const parsed = importRowSchema.safeParse({
    number: text(child(header, "ID")) ?? "",
    debtorName: text(child(buyer, "Name")) ?? "",
    debtorSiren: siren,
    debtorEmail: attribute(email, "schemeID") === "EM" ? text(email) : null,
    // La facturation électronique ne concerne que les échanges entre professionnels.
    clientType: "b2b",
    amountHt: totals.taxBasis ?? totals.grandTotal,
    amountTtc: totals.grandTotal,
    currency: currency ?? "EUR",
    issuedAt,
    dueAt: dueAt ?? (issuedAt ? addDays(issuedAt, DEFAULT_PAYMENT_DAYS) : null),
    paidAt: null,
    externalId: null,
    facturXRaw: {
      profile: text(child(invoice, "ExchangedDocumentContext", "GuidelineSpecifiedDocumentContextParameter", "ID")),
      typeCode: text(child(header, "TypeCode")),
      seller: { name: sellerName, siren: buyerSiren(seller) },
      totals,
    },
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue ? `Facture électronique incomplète : ${issue.message}` : ERRORS.notCii };
  }
  return { ok: true, row: parsed.data, sellerName };
}

const decodeName = (value: PDFString | PDFHexString | undefined) => value?.decodeText() ?? "";

type Attachment = { name: string; stream: PDFRawStream };

function attachmentOf(fileSpec: unknown): Attachment | null {
  if (!(fileSpec instanceof PDFDict)) return null;
  const name = decodeName(fileSpec.lookupMaybe(PDFName.of("UF"), PDFString, PDFHexString)) || decodeName(fileSpec.lookupMaybe(PDFName.of("F"), PDFString, PDFHexString));
  const stream = fileSpec.lookupMaybe(PDFName.of("EF"), PDFDict)?.lookup(PDFName.of("F"));
  return stream instanceof PDFRawStream ? { name, stream } : null;
}

/** Parcourt l'arbre de noms /EmbeddedFiles (feuilles /Names, nœuds /Kids). */
function collectAttachments(node: PDFDict, depth: number): Attachment[] {
  if (depth > MAX_NAME_TREE_DEPTH) return [];
  const names = node.lookupMaybe(PDFName.of("Names"), PDFArray);
  const leaves = names
    ? Array.from({ length: Math.floor(names.size() / 2) }, (_, index) => attachmentOf(names.lookup(index * 2 + 1)))
    : [];
  const kids = node.lookupMaybe(PDFName.of("Kids"), PDFArray);
  const nested = kids
    ? kids.asArray().flatMap((_, index) => {
        const kid = kids.lookup(index);
        return kid instanceof PDFDict ? collectAttachments(kid, depth + 1) : [];
      })
    : [];
  return [...leaves.filter((leaf): leaf is Attachment => leaf !== null), ...nested];
}

function listAttachments(pdf: PDFDocument): Attachment[] {
  const catalog = pdf.catalog;
  const tree = catalog.lookupMaybe(PDFName.of("Names"), PDFDict)?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict);
  const fromTree = tree ? collectAttachments(tree, 0) : [];
  // PDF/A-3 déclare aussi les fichiers associés dans /AF : repli si l'arbre de noms manque.
  const associated = catalog.lookupMaybe(PDFName.of("AF"), PDFArray);
  const fromAf = associated ? associated.asArray().map((_, index) => attachmentOf(associated.lookup(index))) : [];
  return [...fromTree, ...fromAf.filter((item): item is Attachment => item !== null)];
}

function pickInvoiceXml(attachments: readonly Attachment[]): Attachment | undefined {
  const byName = (name: string) => attachments.find((item) => item.name.toLowerCase() === name);
  return PREFERRED_ATTACHMENTS.map(byName).find(Boolean) ?? attachments.find((item) => item.name.toLowerCase().endsWith(".xml"));
}

/** XML de la facture embarqué dans un PDF Factur-X, ou null s'il n'y en a pas. Lève une erreur si le PDF est illisible. */
export async function extractFacturXXml(bytes: Uint8Array): Promise<string | null> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const attachment = pickInvoiceXml(listAttachments(pdf));
  if (!attachment) return null;
  return new TextDecoder("utf-8").decode(decodePDFRawStream(attachment.stream).decode());
}

const looksLikeXml = (bytes: Uint8Array, fileName: string) =>
  fileName.toLowerCase().endsWith(".xml") || new TextDecoder("utf-8").decode(bytes.subarray(0, 64)).trimStart().startsWith("<");

/** Point d'entrée de l'import : PDF Factur-X ou XML CII seul. */
export async function readFacturX(bytes: Uint8Array, fileName: string): Promise<FacturXResult> {
  if (bytes.byteLength > MAX_FACTURX_BYTES) return { ok: false, error: ERRORS.tooLarge };
  if (looksLikeXml(bytes, fileName)) return parseCiiInvoice(new TextDecoder("utf-8").decode(bytes));

  let xml: string | null;
  try {
    xml = await extractFacturXXml(bytes);
  } catch {
    return { ok: false, error: ERRORS.badPdf };
  }
  return xml === null ? { ok: false, error: ERRORS.noXml } : parseCiiInvoice(xml);
}
