import { describe, expect, it } from "vitest";
import { evaluateCsv, guessMapping, mapCsvRecord } from "./csv-mapping";
import { importRowSchema, toRpcRow } from "./import-row";

describe("guessMapping", () => {
  it("reconnaît les en-têtes courants d'un export comptable français", () => {
    const mapping = guessMapping([
      "N° facture",
      "Client",
      "SIRET",
      "Email",
      "Montant HT",
      "Montant TTC",
      "Date",
      "Date d'échéance",
    ]);

    expect(mapping).toMatchObject({
      number: "N° facture",
      debtorName: "Client",
      debtorSiren: "SIRET",
      debtorEmail: "Email",
      amountHt: "Montant HT",
      amountTtc: "Montant TTC",
      issuedAt: "Date",
      dueAt: "Date d'échéance",
    });
  });

  it("n'attribue jamais la même colonne à deux champs", () => {
    const mapping = guessMapping(["Montant", "Date"]);
    const used = Object.values(mapping).filter(Boolean);

    expect(new Set(used).size).toBe(used.length);
  });
});

const MAPPING = {
  number: "Numéro",
  debtorName: "Client",
  debtorSiren: "SIREN",
  amountTtc: "TTC",
  issuedAt: "Émise le",
  dueAt: "Échéance",
} as const;

describe("mapCsvRecord", () => {
  it("transforme une ligne en facture prête à importer", () => {
    const result = mapCsvRecord(
      { Numéro: "F-12", Client: " Atelier Morel ", SIREN: "123 456 782", TTC: "1 200,00 €", "Émise le": "01/09/2026", Échéance: "01/10/2026" },
      MAPPING,
      { clientType: "b2b" },
    );

    expect(result).toEqual({
      ok: true,
      row: expect.objectContaining({
        number: "F-12",
        debtorName: "Atelier Morel",
        debtorSiren: "123456782",
        clientType: "b2b",
        amountTtc: 1200,
        amountHt: 1200,
        currency: "EUR",
        issuedAt: "2026-09-01",
        dueAt: "2026-10-01",
      }),
    });
  });

  it("exige un type de client : colonne ou valeur par défaut", () => {
    const result = mapCsvRecord(
      { Numéro: "F-13", Client: "Studio", TTC: "10", "Émise le": "01/09/2026", Échéance: "01/10/2026" },
      MAPPING,
      {},
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toContain("Type de client (B2B/B2C) manquant.");
  });

  it("lit le type de client depuis une colonne", () => {
    const result = mapCsvRecord(
      { Numéro: "F-14", Client: "Dominique", Type: "Particulier", TTC: "10", "Émise le": "01/09/2026", Échéance: "01/10/2026" },
      { ...MAPPING, clientType: "Type" },
      { clientType: "b2b" },
    );

    expect(result.ok && result.row.clientType).toBe("b2c");
  });

  it("explique chaque erreur en français", () => {
    const result = mapCsvRecord(
      { Numéro: "", Client: "X", TTC: "abc", "Émise le": "01/09/2026", Échéance: "31/08/2026" },
      MAPPING,
      { clientType: "b2b" },
    );

    expect(result.ok ? [] : result.errors).toEqual(
      expect.arrayContaining(["Numéro de facture manquant.", "Montant TTC illisible : « abc »."]),
    );
  });
});

describe("importRowSchema", () => {
  const valid = {
    number: "F-1",
    debtorName: "Atelier",
    debtorSiren: null,
    debtorEmail: null,
    clientType: "b2c",
    amountHt: 100,
    amountTtc: 120,
    currency: "EUR",
    issuedAt: "2026-09-01",
    dueAt: "2026-10-01",
    paidAt: null,
    externalId: null,
    facturXRaw: null,
  };

  it("revalide côté serveur une ligne reçue du navigateur", () => {
    expect(importRowSchema.safeParse(valid).success).toBe(true);
  });

  it("refuse une échéance avant l'émission et un TTC inférieur au HT", () => {
    expect(importRowSchema.safeParse({ ...valid, dueAt: "2026-08-01" }).success).toBe(false);
    expect(importRowSchema.safeParse({ ...valid, amountTtc: 50 }).success).toBe(false);
  });

  it("refuse une devise inconnue (faute de frappe)", () => {
    const result = importRowSchema.safeParse({ ...valid, currency: "UDS" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Devise inconnue : indiquez un code à 3 lettres, par exemple EUR.");
  });

  it("n'accepte qu'un résumé Factur-X de forme connue, sans champ supplémentaire", () => {
    const summary = {
      profile: "urn:cen.eu:en16931:2017",
      typeCode: "380",
      seller: { name: "Atelier Démo", siren: null },
      totals: { taxBasis: 100, tax: 20, grandTotal: 120, duePayable: 120 },
    };

    expect(importRowSchema.safeParse({ ...valid, facturXRaw: summary }).success).toBe(true);
    expect(importRowSchema.safeParse({ ...valid, facturXRaw: { ...summary, blob: "x".repeat(10_000) } }).success).toBe(false);
  });

  it("convertit en format attendu par la fonction SQL d'import", () => {
    expect(toRpcRow(importRowSchema.parse(valid))).toEqual({
      number: "F-1",
      debtor_name: "Atelier",
      debtor_siren: null,
      debtor_email: null,
      client_type: "b2c",
      amount_ht: 100,
      amount_ttc: 120,
      currency: "EUR",
      issued_at: "2026-09-01",
      due_at: "2026-10-01",
      paid_at: null,
      external_id: null,
      factur_x_raw: null,
    });
  });
});

describe("evaluateCsv", () => {
  const mapping = {
    number: "N°",
    debtorName: "Client",
    amountTtc: "TTC",
    issuedAt: "Date",
    dueAt: "Échéance",
  };
  const record = (overrides: Record<string, string> = {}) => ({
    "N°": "F-1",
    Client: "Caradec",
    TTC: "120",
    Date: "01/09/2026",
    Échéance: "01/10/2026",
    ...overrides,
  });

  it("sépare les lignes prêtes des lignes en erreur, numérotées comme dans le tableur", () => {
    const result = evaluateCsv([record(), record({ "N°": "F-2", TTC: "abc" }), record({ "N°": "F-3" })], mapping, {
      clientType: "b2b",
    });

    expect(result.rows.map((row) => row.number)).toEqual(["F-1", "F-3"]);
    expect(result.errors).toEqual([{ line: 3, messages: ["Montant TTC illisible : « abc »."] }]);
    expect(result.missingFields).toEqual([]);
    expect(result.ambiguousAmounts).toEqual([]);
  });

  it("relève les montants lus comme des milliers, pour les faire vérifier", () => {
    const result = evaluateCsv([record({ TTC: "1.234" })], mapping, { clientType: "b2b" });

    expect(result.ambiguousAmounts).toEqual([{ line: 2, raw: "1.234", value: 1234 }]);
  });

  it("liste les colonnes obligatoires non associées", () => {
    const partial = { debtorName: "Client", amountTtc: "TTC", issuedAt: "Date" };

    expect(evaluateCsv([record()], partial, { clientType: "b2b" }).missingFields).toEqual(["number", "dueAt"]);
  });
});
