import { describe, expect, it } from "vitest";
import { parseElectronicInvoiceXml, rootElement } from "./electronic-invoice";
import { parseUblInvoice } from "./ubl";

/** Facture roumaine e-Factura : UBL, leu roumain, CUI au lieu d'un SIREN. */
const ROMANIAN = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
             xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
             xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
  <cbc:ID>RO-2026-0042</cbc:ID>
  <cbc:IssueDate>2026-09-01</cbc:IssueDate>
  <cbc:DueDate>2026-10-01</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>RON</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyLegalEntity><cbc:RegistrationName>Atelier Bucuresti SRL</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cbc:EndpointID schemeID="EM">contabilitate@client.ro</cbc:EndpointID>
    <cac:PartyLegalEntity>
      <cbc:RegistrationName>Client Industrial SRL</cbc:RegistrationName>
      <cbc:CompanyID schemeID="0190">RO12345678</cbc:CompanyID>
    </cac:PartyLegalEntity>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="RON">1900.00</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="RON">10000.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="RON">11900.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="RON">11900.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</ubl:Invoice>`;

describe("parseUblInvoice", () => {
  it("lit une facture roumaine : montants en lei, client, échéance", () => {
    const result = parseUblInvoice(ROMANIAN);

    expect(result).toMatchObject({ ok: true, sellerName: "Atelier Bucuresti SRL" });
    if (!result.ok) return;
    expect(result.row).toMatchObject({
      number: "RO-2026-0042",
      debtorName: "Client Industrial SRL",
      debtorEmail: "contabilitate@client.ro",
      clientType: "b2b",
      amountHt: 10000,
      amountTtc: 11900,
      currency: "RON",
      issuedAt: "2026-09-01",
      dueAt: "2026-10-01",
    });
  });

  it("n'invente pas de SIREN à partir d'un identifiant étranger", () => {
    const result = parseUblInvoice(ROMANIAN);

    // Le CUI roumain n'est pas un SIREN : le champ reste vide plutôt que d'être rempli de travers.
    expect(result.ok && result.row.debtorSiren).toBeNull();
  });

  it("accepte un SIREN français quand le registre l'annonce", () => {
    const result = parseUblInvoice(ROMANIAN.replace('schemeID="0190">RO12345678', 'schemeID="0002">732829320'));

    expect(result.ok && result.row.debtorSiren).toBe("732829320");
  });

  it("sans échéance, applique le délai supplétif de 30 jours", () => {
    const result = parseUblInvoice(ROMANIAN.replace("<cbc:DueDate>2026-10-01</cbc:DueDate>", ""));

    expect(result.ok && result.row.dueAt).toBe("2026-10-01");
  });

  it("refuse un avoir en le nommant, plutôt que de le dire illisible", () => {
    const creditNote = ROMANIAN.replace(/ubl:Invoice/g, "ubl:CreditNote");

    expect(parseUblInvoice(creditNote)).toEqual({ ok: false, error: expect.stringContaining("avoir") });
  });

  it("refuse un document qui déclare un DOCTYPE (expansion d'entités)", () => {
    const withDoctype = `<!DOCTYPE Invoice [<!ENTITY x "y">]>${ROMANIAN}`;

    expect(parseUblInvoice(withDoctype).ok).toBe(false);
  });
});

describe("choix de la syntaxe", () => {
  it("reconnaît la racine en ignorant le préfixe de namespace", () => {
    expect(rootElement(ROMANIAN)).toBe("Invoice");
    expect(rootElement('<?xml version="1.0"?><rsm:CrossIndustryInvoice/>')).toBe("CrossIndustryInvoice");
    expect(rootElement("pas du xml")).toBeNull();
  });

  it("ignore les commentaires et la déclaration, qui précèdent la racine", () => {
    // Un Factur-X dont un commentaire mentionne <Invoice> partait vers le lecteur UBL.
    expect(rootElement('<?xml version="1.0"?><!-- exemple : <Invoice> --><rsm:CrossIndustryInvoice/>')).toBe(
      "CrossIndustryInvoice",
    );
    expect(rootElement("<!-- voir <CrossIndustryInvoice> --><Invoice/>")).toBe("Invoice");
  });

  it("un avoir reste refusé même précédé d'un commentaire trompeur", () => {
    const disguised = "<!-- <Invoice/> -->" + ROMANIAN.replace(/ubl:Invoice/g, "ubl:CreditNote");

    expect(parseElectronicInvoiceXml(disguised)).toEqual({ ok: false, error: expect.stringContaining("avoir") });
  });

  it("oriente une facture UBL vers le bon lecteur", () => {
    expect(parseElectronicInvoiceXml(ROMANIAN)).toMatchObject({ ok: true });
  });

  it("nomme la syntaxe inconnue au lieu de parler de fichier illisible", () => {
    expect(parseElectronicInvoiceXml("<Bidule><ID>1</ID></Bidule>")).toEqual({
      ok: false,
      error: expect.stringContaining("ni Factur-X, ni UBL"),
    });
  });
});
