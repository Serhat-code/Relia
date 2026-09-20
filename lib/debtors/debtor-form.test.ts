import { describe, expect, it } from "vitest";
import { parseDebtorForm } from "./debtor-form";

const COMPANY = {
  name: "  Menuiserie Caradec & Fils ",
  clientType: "b2b",
  legalForm: "legal_entity",
  siren: "123 456 782",
  contactName: "Yann Caradec",
  contactEmail: "compta@caradec.example",
  phone: "02 98 00 00 00",
  address: "4 rue du Port, 29000 Quimper",
  notes: "",
};

describe("parseDebtorForm", () => {
  it("lit une personne morale complète", () => {
    expect(parseDebtorForm(COMPANY)).toEqual({
      ok: true,
      debtor: {
        name: "Menuiserie Caradec & Fils",
        clientType: "b2b",
        siren: "123456782",
        isLegalEntity: true,
        contactName: "Yann Caradec",
        contactEmail: "compta@caradec.example",
        phone: "02 98 00 00 00",
        address: "4 rue du Port, 29000 Quimper",
        notes: null,
      },
    });
  });

  it("un particulier n'est jamais une personne morale, quelle que soit la saisie", () => {
    const result = parseDebtorForm({ ...COMPANY, clientType: "b2c", legalForm: "legal_entity", siren: "" });

    expect(result.ok && result.debtor).toMatchObject({ clientType: "b2c", isLegalEntity: false, siren: null });
  });

  it("un entrepreneur individuel garde son SIREN mais n'est pas une personne morale", () => {
    const result = parseDebtorForm({ ...COMPANY, legalForm: "individual" });

    expect(result.ok && result.debtor).toMatchObject({ isLegalEntity: false, siren: "123456782" });
  });

  it("exige le SIREN d'une personne morale et refuse un SIREN invalide", () => {
    expect(parseDebtorForm({ ...COMPANY, siren: "" })).toEqual({
      ok: false,
      fieldErrors: { siren: "Indiquez le SIREN : il identifie la personne morale." },
    });
    expect(parseDebtorForm({ ...COMPANY, siren: "123456789" })).toEqual({
      ok: false,
      fieldErrors: { siren: "SIREN invalide : 9 chiffres, clé de contrôle comprise." },
    });
  });

  it("signale nom, type et e-mail invalides", () => {
    expect(parseDebtorForm({ ...COMPANY, name: " ", clientType: "", contactEmail: "pas-un-mail" })).toEqual({
      ok: false,
      fieldErrors: {
        name: "Indiquez le nom du client.",
        clientType: "Précisez s'il s'agit d'un professionnel ou d'un particulier.",
        contactEmail: "Adresse e-mail invalide.",
      },
    });
  });
});
