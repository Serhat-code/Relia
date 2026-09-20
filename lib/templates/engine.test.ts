import { describe, expect, it } from "vitest";
import { findTemplateViolations } from "@/lib/compliance/template-rules";
import { formatCurrency } from "@/lib/format";
import { extractVariables, markdownToHtml, renderTemplate, TEMPLATE_VARIABLES, type RenderContext } from "./engine";
import { SYSTEM_TEMPLATES } from "./system-templates";

const CONTEXT: RenderContext = {
  debtor: { clientType: "b2b", name: "Menuiserie Caradec & Fils", contactName: "Yann Caradec" },
  invoice: { number: "F-2026-042", amountTtc: 1200, currency: "EUR", issuedAt: "2026-08-01", dueAt: "2026-08-31" },
  organizationName: "Atelier Démo",
  today: "2026-09-18",
};

const template = (overrides: Partial<Parameters<typeof renderTemplate>[0]> = {}) => ({
  clientType: "b2b" as const,
  subject: "Facture {{numero_facture}}",
  bodyMarkdown: "{{salutation}}\n\nLa facture de {{montant}} {{statut_echeance}}.\n\n{{nom_entreprise}}",
  ...overrides,
});

describe("renderTemplate", () => {
  it("remplace les variables par les valeurs de la facture, au format français", () => {
    const result = renderTemplate(template(), CONTEXT);

    expect(result).toMatchObject({
      ok: true,
      subject: "Facture F-2026-042",
      bodyText: `Bonjour Yann Caradec,\n\nLa facture de ${formatCurrency(1200)} est arrivée à échéance le 31/08/2026.\n\nAtelier Démo`,
    });
  });

  it("refuse de rendre un modèle B2B pour un débiteur B2C (§2.5)", () => {
    const consumer = { ...CONTEXT, debtor: { ...CONTEXT.debtor, clientType: "b2c" as const } };

    expect(renderTemplate(template({ clientType: "b2b" }), consumer)).toEqual({
      ok: false,
      error: "Un modèle pour professionnels ne peut pas être envoyé à un particulier.",
    });
  });

  it("n'utilise pas non plus un modèle pour particuliers avec un professionnel", () => {
    expect(renderTemplate(template({ clientType: "b2c" }), CONTEXT)).toEqual({
      ok: false,
      error: "Un modèle pour particuliers ne s'utilise pas avec un professionnel.",
    });
  });

  it("refuse une variable inconnue plutôt que d'envoyer un texte à trous", () => {
    expect(renderTemplate(template({ bodyMarkdown: "Bonjour {{prenom}}" }), CONTEXT)).toEqual({
      ok: false,
      error: "Variable inconnue : {{prenom}}.",
    });
  });

  it("adapte l'échéance et la formule d'appel", () => {
    const beforeDue = { ...CONTEXT, today: "2026-08-28", debtor: { ...CONTEXT.debtor, contactName: null } };

    const result = renderTemplate(template({ bodyMarkdown: "{{salutation}} {{statut_echeance}} ({{retard}})" }), beforeDue);

    expect(result.ok && result.bodyText).toBe("Bonjour, arrive à échéance le 31/08/2026 (aucun retard)");
  });
});

describe("extractVariables", () => {
  it("liste les variables utilisées, espaces tolérés", () => {
    expect(extractVariables("{{ montant }} et {{numero_facture}} et {{montant}}")).toEqual(["montant", "numero_facture"]);
  });
});

describe("markdownToHtml", () => {
  it("échappe le HTML, garde les paragraphes, les retours à la ligne et le gras", () => {
    expect(markdownToHtml("Bonjour <b>toi</b>,\n\nMontant : **1 200 €**\nÉchéance")).toBe(
      "<p>Bonjour &lt;b&gt;toi&lt;/b&gt;,</p>\n<p>Montant : <strong>1 200 €</strong><br>Échéance</p>",
    );
  });
});

describe("modèles système", () => {
  it("un modèle par type de client et par ton", () => {
    const keys = SYSTEM_TEMPLATES.map((system) => `${system.clientType}/${system.tone}`).sort();

    expect(keys).toEqual([
      "b2b/courtois",
      "b2b/ferme",
      "b2b/mise_en_demeure",
      "b2c/courtois",
      "b2c/ferme",
      "b2c/mise_en_demeure",
    ]);
  });

  it.each(SYSTEM_TEMPLATES.map((system) => [system.name, system] as const))(
    "« %s » respecte la liste noire et les mentions réservées",
    (_name, system) => {
      expect(findTemplateViolations({ clientType: system.clientType, subject: system.subject, body: system.bodyMarkdown })).toEqual(
        [],
      );
    },
  );

  it.each(SYSTEM_TEMPLATES.map((system) => [system.name, system] as const))(
    "« %s » n'utilise que des variables connues et se rend sans erreur",
    (_name, system) => {
      const context = { ...CONTEXT, debtor: { ...CONTEXT.debtor, clientType: system.clientType } };
      const used = extractVariables(`${system.subject}\n${system.bodyMarkdown}`);

      expect(used.every((name) => name in TEMPLATE_VARIABLES)).toBe(true);
      expect(renderTemplate(system, context).ok).toBe(true);
    },
  );

  it("seuls les modèles B2B rappellent l'indemnité de 40 €", () => {
    const mentions = SYSTEM_TEMPLATES.filter((system) => system.bodyMarkdown.includes("40 €"));

    expect(mentions.length).toBeGreaterThan(0);
    expect(mentions.every((system) => system.clientType === "b2b")).toBe(true);
  });
});
