import { describe, expect, it } from "vitest";
import { confirmsOrganizationName, parseOrganizationForm, parseRetention, RETENTION_OPTIONS } from "./settings-form";

describe("parseOrganizationForm", () => {
  it("normalise le SIREN et accepte son absence", () => {
    expect(parseOrganizationForm({ name: "  Atelier Démo ", siren: "732 829 320" })).toEqual({
      ok: true,
      value: { name: "Atelier Démo", siren: "732829320", currency: "EUR" },
    });
    expect(parseOrganizationForm({ name: "Atelier Démo", siren: "" })).toEqual({
      ok: true,
      value: { name: "Atelier Démo", siren: null, currency: "EUR" },
    });
  });

  it("refuse un nom vide et un SIREN dont la clé est fausse", () => {
    expect(parseOrganizationForm({ name: " ", siren: "732829321" })).toEqual({
      ok: false,
      fieldErrors: { name: "Indiquez le nom de votre entreprise.", siren: "SIREN invalide : 9 chiffres." },
    });
  });

  it("retient la devise de travail, en majuscules, et l'euro à défaut", () => {
    expect(parseOrganizationForm({ name: "Atelier Bucarest", siren: "", currency: "ron" })).toMatchObject({
      ok: true,
      value: { currency: "RON" },
    });
    expect(parseOrganizationForm({ name: "Atelier Démo", siren: "" })).toMatchObject({ ok: true, value: { currency: "EUR" } });
  });

  it("refuse une devise qui n'est pas un code ISO connu", () => {
    // « UDS » pour « USD » : une faute de frappe ne doit pas devenir la devise de l'organisation.
    expect(parseOrganizationForm({ name: "Atelier Démo", siren: "", currency: "UDS" })).toMatchObject({
      ok: false,
      fieldErrors: { currency: expect.stringContaining("Devise inconnue") },
    });
  });
});

describe("parseRetention", () => {
  it("n'accepte que les durées proposées, 3 ans étant recommandé", () => {
    expect(parseRetention("36")).toBe(36);
    expect(parseRetention("7")).toBeNull();
    expect(parseRetention(undefined)).toBeNull();
    expect(RETENTION_OPTIONS.every((option) => option.months >= 12 && option.months <= 120)).toBe(true);
  });
});

describe("confirmsOrganizationName", () => {
  it("accepte le nom saisi sans tenir compte de la casse ni des espaces, jamais un champ vide", () => {
    expect(confirmsOrganizationName("  atelier   démo ", "Atelier Démo")).toBe(true);
    expect(confirmsOrganizationName("Atelier", "Atelier Démo")).toBe(false);
    expect(confirmsOrganizationName("   ", "   ")).toBe(false);
  });
});
