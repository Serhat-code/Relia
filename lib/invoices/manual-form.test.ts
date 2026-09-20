import { describe, expect, it } from "vitest";
import { parseManualInvoice } from "./manual-form";

const VALID = {
  number: " F-2026-042 ",
  debtorName: "Menuiserie Caradec",
  clientType: "b2b",
  debtorSiren: "123 456 782",
  debtorEmail: "compta@caradec.example",
  amountHt: "1 000,00",
  amountTtc: "1 200,00",
  issuedAt: "2026-09-01",
  dueAt: "2026-10-01",
};

describe("parseManualInvoice", () => {
  it("transforme la saisie en facture à importer", () => {
    expect(parseManualInvoice(VALID)).toEqual({
      ok: true,
      row: {
        number: "F-2026-042",
        debtorName: "Menuiserie Caradec",
        debtorSiren: "123456782",
        debtorEmail: "compta@caradec.example",
        clientType: "b2b",
        amountHt: 1000,
        amountTtc: 1200,
        currency: "EUR",
        issuedAt: "2026-09-01",
        dueAt: "2026-10-01",
        paidAt: null,
        externalId: null,
        facturXRaw: null,
      },
    });
  });

  it("reprend le TTC quand le HT n'est pas indiqué, et accepte un client sans SIREN ni e-mail", () => {
    const result = parseManualInvoice({ ...VALID, clientType: "b2c", amountHt: "", debtorSiren: "", debtorEmail: "" });

    expect(result.ok && result.row).toMatchObject({ clientType: "b2c", amountHt: 1200, debtorSiren: null, debtorEmail: null });
  });

  it("signale chaque champ obligatoire manquant", () => {
    const result = parseManualInvoice({});

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        number: "Indiquez le numéro de la facture.",
        debtorName: "Indiquez le nom du client.",
        clientType: "Précisez s'il s'agit d'un professionnel ou d'un particulier.",
        amountTtc: "Indiquez le montant TTC.",
        issuedAt: "Indiquez la date d'émission.",
        dueAt: "Indiquez l'échéance.",
      },
    });
  });

  it("refuse un SIREN invalide, un montant illisible et des montants incohérents", () => {
    expect(parseManualInvoice({ ...VALID, debtorSiren: "123456789" })).toMatchObject({
      ok: false,
      fieldErrors: { debtorSiren: "SIREN du client invalide." },
    });
    expect(parseManualInvoice({ ...VALID, amountTtc: "douze" })).toMatchObject({
      ok: false,
      fieldErrors: { amountTtc: "Montant illisible : « douze »." },
    });
    expect(parseManualInvoice({ ...VALID, amountTtc: "900" })).toMatchObject({
      ok: false,
      fieldErrors: { amountTtc: "Le montant TTC est inférieur au montant HT." },
    });
    expect(parseManualInvoice({ ...VALID, dueAt: "2026-08-01" })).toMatchObject({
      ok: false,
      fieldErrors: { dueAt: "L'échéance précède la date d'émission." },
    });
  });
});
