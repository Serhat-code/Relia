import { extractFacturXXml, MAX_FACTURX_BYTES, parseCiiInvoice } from "./facturx";
import type { ImportRow } from "./import-row";
import { parseUblInvoice } from "./ubl";

/**
 * Point d'entrée de l'import d'une facture électronique. La norme européenne EN 16931 admet deux
 * syntaxes, et Relia lit les deux :
 *
 * - **CII**, celle du Factur-X franco-allemand, livrée dans un PDF/A-3 ou seule en XML ;
 * - **UBL**, celle de la plupart des autres pays de l'Union — e-Factura roumain, Croatie, Peppol.
 *
 * La syntaxe se reconnaît à l'élément racine, ce qui évite de deviner : un message d'erreur juste
 * vaut mieux qu'un « fichier illisible » sur une facture parfaitement valide d'un autre pays.
 */

export type ElectronicInvoiceResult =
  | { ok: true; row: ImportRow; sellerName: string | null }
  | { ok: false; error: string };

const ERRORS = {
  unknown: "Ce fichier n'est pas une facture électronique reconnue (ni Factur-X, ni UBL).",
  noXml: "Ce PDF ne contient pas de facture électronique.",
  badPdf: "Ce fichier PDF est illisible ou endommagé.",
  tooLarge: "Ce fichier dépasse 10 Mo.",
} as const;

/** Élément racine, préfixe de namespace retiré : « rsm:CrossIndustryInvoice » → « CrossIndustryInvoice ». */
export function rootElement(xml: string): string | null {
  // On saute la déclaration XML, les commentaires et les instructions de traitement.
  const match = xml.match(/<\s*([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)/);
  return match?.[2] && !/^(\?|!)/.test(match[2]) ? match[2] : null;
}

/** Choisit le lecteur d'après la racine du document. */
export function parseElectronicInvoiceXml(xml: string): ElectronicInvoiceResult {
  switch (rootElement(xml)) {
    case "CrossIndustryInvoice":
      return parseCiiInvoice(xml);
    case "Invoice":
    case "CreditNote":
      return parseUblInvoice(xml);
    default:
      return { ok: false, error: ERRORS.unknown };
  }
}

const looksLikeXml = (bytes: Uint8Array, fileName: string) =>
  fileName.toLowerCase().endsWith(".xml") ||
  new TextDecoder("utf-8").decode(bytes.subarray(0, 64)).trimStart().startsWith("<");

export async function readElectronicInvoice(bytes: Uint8Array, fileName: string): Promise<ElectronicInvoiceResult> {
  if (bytes.byteLength > MAX_FACTURX_BYTES) return { ok: false, error: ERRORS.tooLarge };
  if (looksLikeXml(bytes, fileName)) return parseElectronicInvoiceXml(new TextDecoder("utf-8").decode(bytes));

  // Un PDF ne porte, en pratique, que du CII : c'est la forme du Factur-X et du ZUGFeRD.
  let xml: string | null;
  try {
    xml = await extractFacturXXml(bytes);
  } catch {
    return { ok: false, error: ERRORS.badPdf };
  }
  return xml === null ? { ok: false, error: ERRORS.noXml } : parseElectronicInvoiceXml(xml);
}
