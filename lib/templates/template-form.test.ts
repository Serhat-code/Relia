import { describe, expect, it } from "vitest";
import { parseTemplateForm } from "./template-form";

const VALID = {
  name: "  Mon rappel ",
  subject: "Facture {{numero_facture}}",
  bodyMarkdown: "{{salutation}}\n\nMerci de régler {{montant}}.\n\n{{nom_entreprise}}",
};

describe("parseTemplateForm", () => {
  it("accepte un modèle conforme et relève ses variables", () => {
    expect(parseTemplateForm(VALID, "b2c")).toEqual({
      ok: true,
      template: {
        name: "Mon rappel",
        subject: "Facture {{numero_facture}}",
        bodyMarkdown: VALID.bodyMarkdown,
        variables: ["numero_facture", "salutation", "montant", "nom_entreprise"],
      },
    });
  });

  it("refuse une menace et explique pourquoi", () => {
    const result = parseTemplateForm({ ...VALID, bodyMarkdown: "Sans règlement, un huissier passera." }, "b2b");

    expect(result).toEqual({
      ok: false,
      fieldErrors: { bodyMarkdown: "« huissier » : menace interdite dans une relance." },
    });
  });

  it("refuse les pénalités dans un modèle pour particuliers", () => {
    const result = parseTemplateForm({ ...VALID, bodyMarkdown: "Une indemnité forfaitaire de 40 € s'applique." }, "b2c");

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.fieldErrors.bodyMarkdown).toContain("réservé aux professionnels");
  });

  it("refuse une variable inconnue et les champs vides", () => {
    expect(parseTemplateForm({ name: "", subject: "", bodyMarkdown: "Bonjour {{prenom}}" }, "b2b")).toEqual({
      ok: false,
      fieldErrors: {
        name: "Donnez un nom au modèle.",
        subject: "Indiquez l'objet du message.",
        bodyMarkdown: "Variable inconnue : {{prenom}}.",
      },
    });
  });
});
