import { describe, expect, it } from "vitest";
import { B2C_FORBIDDEN_MENTIONS, THREAT_TERMS, findTemplateViolations } from "./template-rules";

describe("liste noire des menaces (§2.6)", () => {
  it.each([
    "Sans règlement, nous procéderons à une saisie.",
    "Le dossier sera transmis à un huissier.",
    "Nous ferons appel à un commissaire de justice.",
    "Une procédure judiciaire sera engagée.",
    "Nous engagerons des poursuites.",
    "Nous déposerons une requête en injonction de payer.",
    "Ce retard entraînera votre fichage.",
    "Votre dossier fera l'objet d'une mise en recouvrement.",
    "Nous saisirons le tribunal de commerce.",
    "Notre avocat prendra contact avec vous.",
    "Le dossier passera au service contentieux.",
  ])("refuse : « %s »", (text) => {
    expect(findTemplateViolations({ clientType: "b2b", subject: "Relance", body: text })).not.toEqual([]);
  });

  it("accepte la mise en demeure factuelle autorisée", () => {
    const body =
      "Sans règlement sous huit jours, le dossier pourra être confié à un tiers. Montant dû : 1 200,00 €, échu le 01/09/2026.";

    expect(findTemplateViolations({ clientType: "b2b", subject: "Mise en demeure", body })).toEqual([]);
  });

  it("ne confond pas les mots proches (« saisissez », « procédure de commande »)", () => {
    const body = "Saisissez la référence de la facture. Notre procédure de commande est simple.";

    expect(findTemplateViolations({ clientType: "b2b", subject: "Relance", body })).toEqual([]);
  });

  it("vérifie aussi l'objet du message", () => {
    expect(findTemplateViolations({ clientType: "b2b", subject: "Avant huissier", body: "Bonjour" })).toEqual([
      "« huissier » : menace interdite dans une relance.",
    ]);
  });

  it("couvre chaque terme de la liste", () => {
    for (const { example } of THREAT_TERMS) {
      expect(findTemplateViolations({ clientType: "b2b", subject: "", body: example })).not.toEqual([]);
    }
  });
});

describe("mentions réservées aux professionnels (§2.5)", () => {
  const penalties =
    "Conformément à l'article L441-10 du Code de commerce, une indemnité forfaitaire de 40 € et des pénalités de retard au taux de la BCE majoré de 10 points sont exigibles.";

  it("un modèle B2B peut rappeler l'indemnité et les pénalités", () => {
    expect(findTemplateViolations({ clientType: "b2b", subject: "Relance", body: penalties })).toEqual([]);
  });

  it("un modèle B2C ne les mentionne jamais", () => {
    const violations = findTemplateViolations({ clientType: "b2c", subject: "Relance", body: penalties });

    expect(violations.length).toBeGreaterThan(0);
    expect(violations.every((violation) => violation.includes("réservé aux professionnels"))).toBe(true);
  });

  it("couvre chaque mention réservée", () => {
    for (const { example } of B2C_FORBIDDEN_MENTIONS) {
      expect(findTemplateViolations({ clientType: "b2c", subject: "", body: example })).not.toEqual([]);
    }
  });

  it("applique aussi les termes interdits de l'interface (§2.1)", () => {
    expect(findTemplateViolations({ clientType: "b2c", subject: "", body: "Notre agence vous contacte." })).toEqual([
      "« agence » : terme interdit dans les messages de Relia.",
    ]);
  });
});

describe("texte collé depuis un traitement de texte (revue du palier 8)", () => {
  const NBSP = String.fromCharCode(0xa0);
  const NARROW_NBSP = String.fromCharCode(0x202f);
  const ZERO_WIDTH = String.fromCharCode(0x200b);

  it("repère une menace malgré des espaces insécables, un retour à la ligne ou un caractère invisible", () => {
    for (const body of [
      `Un commissaire${NBSP}de${NBSP}justice.`,
      "Une injonction\nde payer.",
      `Un huis${ZERO_WIDTH}sier.`,
    ]) {
      expect(findTemplateViolations({ clientType: "b2b", subject: "", body })).not.toEqual([]);
    }
  });

  it("repère « 40 € » séparé par une espace fine insécable dans un modèle B2C", () => {
    expect(findTemplateViolations({ clientType: "b2c", subject: "", body: `Frais : 40${NARROW_NBSP}€.` })).not.toEqual([]);
  });
});
