import { readFileSync } from "node:fs";
import { AFRelationship, PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { extractFacturXXml, parseCiiInvoice, readFacturX } from "./facturx";

const SAMPLE_XML = readFileSync(new URL("../../tests/fixtures/factur-x.xml", import.meta.url), "utf8");

async function pdfWithAttachment(xml: string | null): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  if (xml !== null) {
    await pdf.attach(new TextEncoder().encode(xml), "factur-x.xml", {
      mimeType: "text/xml",
      description: "Factur-X",
      afRelationship: AFRelationship.Alternative,
    });
  }
  return pdf.save();
}

describe("parseCiiInvoice", () => {
  it("lit numéro, dates, montants, devise et acheteur d'une facture CII", () => {
    const result = parseCiiInvoice(SAMPLE_XML);

    expect(result).toEqual({
      ok: true,
      sellerName: "Atelier Démo",
      row: expect.objectContaining({
        number: "FX-2026-001",
        debtorName: "Menuiserie Caradec & Fils",
        debtorSiren: "123456782",
        debtorEmail: "compta@caradec.example",
        clientType: "b2b",
        amountHt: 1000,
        amountTtc: 1200,
        currency: "EUR",
        issuedAt: "2026-09-01",
        dueAt: "2026-10-01",
      }),
    });
  });

  it("conserve un résumé structuré de la facture électronique", () => {
    const result = parseCiiInvoice(SAMPLE_XML);

    expect(result.ok && result.row.facturXRaw).toMatchObject({
      profile: "urn:cen.eu:en16931:2017",
      typeCode: "380",
      totals: { taxBasis: 1000, tax: 200, grandTotal: 1200, duePayable: 1200 },
    });
  });

  it("sans échéance, applique le délai légal par défaut de 30 jours", () => {
    const withoutDueDate = SAMPLE_XML.replace(/<ram:SpecifiedTradePaymentTerms>[\s\S]*?<\/ram:SpecifiedTradePaymentTerms>/, "");

    const result = parseCiiInvoice(withoutDueDate);

    expect(result.ok && result.row.dueAt).toBe("2026-10-01");
  });

  it("refuse un XML qui n'est pas une facture CII", () => {
    expect(parseCiiInvoice("<Invoice><ID>1</ID></Invoice>")).toEqual({
      ok: false,
      error: "Ce fichier n'est pas une facture Factur-X (syntaxe CII).",
    });
  });
});

describe("extractFacturXXml", () => {
  it("extrait le XML embarqué dans le PDF", async () => {
    expect(await extractFacturXXml(await pdfWithAttachment(SAMPLE_XML))).toBe(SAMPLE_XML);
  });

  it("renvoie null pour un PDF sans XML embarqué", async () => {
    expect(await extractFacturXXml(await pdfWithAttachment(null))).toBeNull();
  });
});

describe("readFacturX", () => {
  it("accepte un PDF Factur-X comme un XML seul", async () => {
    const fromPdf = await readFacturX(await pdfWithAttachment(SAMPLE_XML), "facture.pdf");
    const fromXml = await readFacturX(new TextEncoder().encode(SAMPLE_XML), "facture.xml");

    expect(fromPdf.ok && fromPdf.row.number).toBe("FX-2026-001");
    expect(fromXml.ok && fromXml.row.number).toBe("FX-2026-001");
  });

  it("explique pourquoi un PDF ordinaire n'est pas lisible", async () => {
    expect(await readFacturX(await pdfWithAttachment(null), "scan.pdf")).toEqual({
      ok: false,
      error: "Ce PDF ne contient pas de facture électronique Factur-X.",
    });
  });

  it("refuse un fichier illisible sans planter", async () => {
    expect(await readFacturX(new TextEncoder().encode("pas un pdf"), "x.pdf")).toEqual({
      ok: false,
      error: "Ce fichier PDF est illisible ou endommagé.",
    });
  });
});

describe("dates des factures électroniques", () => {
  it("refuse une date qui n'existe pas (30 février)", () => {
    const impossible = SAMPLE_XML.replace("20260901", "20260230");

    expect(parseCiiInvoice(impossible)).toMatchObject({ ok: false });
  });
});
