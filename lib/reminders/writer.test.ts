import { describe, expect, it } from "vitest";
import type { LLMProvider } from "@/lib/ai/llm-provider";
import type { RenderContext } from "@/lib/templates/engine";
import { SYSTEM_TEMPLATES } from "@/lib/templates/system-templates";
import { writeReminder } from "./writer";

const CONTEXT: RenderContext = {
  debtor: { clientType: "b2b", name: "Menuiserie Caradec & Fils", contactName: "Yann Caradec" },
  invoice: { number: "F-2026-042", amountTtc: 1200, currency: "EUR", issuedAt: "2026-08-01", dueAt: "2026-08-31" },
  organizationName: "Atelier Démo",
  today: "2026-09-18",
};

const firm = SYSTEM_TEMPLATES.find((template) => template.clientType === "b2b" && template.tone === "ferme");
const consumerFirm = SYSTEM_TEMPLATES.find((template) => template.clientType === "b2c" && template.tone === "ferme");
if (!firm || !consumerFirm) throw new Error("modèles système manquants");

const provider = (answer: string | null | Error): LLMProvider => ({
  name: "Faux",
  complete: async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  },
});

const aiAnswer = (message: string, objet = "Facture F-2026-042 : règlement attendu") => JSON.stringify({ objet, message });

describe("writeReminder", () => {
  it("sans fournisseur, reprend le modèle rempli", async () => {
    const result = await writeReminder({ template: firm, context: CONTEXT, provider: null });

    expect(result).toMatchObject({ ok: true, isAiGenerated: false, subject: "Facture F-2026-042 en attente de règlement" });
  });

  it("garde une reformulation conforme et la marque comme assistée par IA", async () => {
    const message =
      "Bonjour Yann,\n\nNotre facture F-2026-042 de 1 200,00 € reste impayée depuis le 31/08/2026. Pouvez-vous nous indiquer une date de règlement ?\n\nAtelier Démo";
    const result = await writeReminder({ template: firm, context: CONTEXT, provider: provider(aiAnswer(message)) });

    expect(result).toMatchObject({ ok: true, isAiGenerated: true, bodyMarkdown: message });
  });

  it.each([
    ["une menace", aiAnswer("Facture F-2026-042 de 1 200,00 € : sans règlement, un huissier passera.")],
    ["un numéro de facture oublié", aiAnswer("Merci de régler 1 200,00 € rapidement.")],
    ["une variable non remplie", aiAnswer("Facture F-2026-042 de 1 200,00 €, {{retard}}.")],
    ["une réponse illisible", "pas du JSON"],
    ["une panne du fournisseur", new Error("délai dépassé")],
    ["aucune réponse", null],
  ])("revient au modèle en cas de %s", async (_case, answer) => {
    const result = await writeReminder({ template: firm, context: CONTEXT, provider: provider(answer) });

    expect(result).toMatchObject({ ok: true, isAiGenerated: false });
  });

  it("refuse les pénalités professionnelles proposées par l'IA pour un particulier", async () => {
    const context = { ...CONTEXT, debtor: { ...CONTEXT.debtor, clientType: "b2c" as const } };
    const answer = aiAnswer("Facture F-2026-042 de 1 200,00 € : une indemnité forfaitaire de 40 € s'ajoute.");

    const result = await writeReminder({ template: consumerFirm, context, provider: provider(answer) });

    expect(result).toMatchObject({ ok: true, isAiGenerated: false });
  });

  it("n'écrit jamais pour le mauvais type de client", async () => {
    const context = { ...CONTEXT, debtor: { ...CONTEXT.debtor, clientType: "b2c" as const } };

    expect(await writeReminder({ template: firm, context, provider: null })).toMatchObject({ ok: false });
  });
});
