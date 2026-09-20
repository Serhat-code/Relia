import { z } from "zod";
import type { LLMProvider } from "@/lib/ai/llm-provider";
import { findTemplateViolations, normalizeForRules } from "@/lib/compliance/template-rules";
import { renderTemplate, variableValues, type RenderableTemplate, type RenderContext } from "@/lib/templates/engine";

/**
 * Rédaction d'une relance (§5.4) : le modèle, rempli, fait foi. L'IA (si configurée) le reformule
 * pour ce client précis ; sa proposition n'est gardée que si elle respecte les mêmes règles
 * (§2.5, §2.6) et reprend les faits (numéro, montant). Sinon, le texte du modèle part tel quel.
 */

export type WrittenReminder =
  | { ok: true; subject: string; bodyMarkdown: string; isAiGenerated: boolean }
  | { ok: false; error: string };

const MAX_TOKENS = 700;
const MAX_BODY_LENGTH = 3000;

const SYSTEM_PROMPT = `Tu reformules des relances de factures impayées, en français, pour une petite entreprise qui écrit à son propre client.
Règles impératives :
- Garde tous les faits du texte fourni (numéro de facture, montant, dates) à l'identique ; n'en invente aucun.
- Garde le ton demandé, poli et professionnel, et la signature.
- Aucune menace : ne parle jamais de saisie, d'huissier, de commissaire de justice, de tribunal, de procédure judiciaire, de poursuites, d'injonction de payer, d'avocat, de contentieux, de fichage ni de plainte.
- Pour un particulier, ne mentionne jamais d'indemnité forfaitaire, de pénalités ou d'intérêts de retard, de taux BCE ni d'article de loi.
- Pour une mise en demeure, reste factuel : montant, échéance dépassée, délai demandé, et au plus le fait que le dossier pourra être confié à un tiers.
- Au plus 180 mots. **texte** pour le gras, une ligne vide entre les paragraphes.
Réponds uniquement en JSON : {"objet": "...", "message": "..."}.`;

const TONE_LABELS = { courtois: "courtois", ferme: "ferme mais courtois", mise_en_demeure: "mise en demeure factuelle" } as const;

const answerSchema = z.object({
  objet: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(MAX_BODY_LENGTH),
});

type WriteInput = {
  template: RenderableTemplate & { tone: keyof typeof TONE_LABELS };
  context: RenderContext;
  provider: LLMProvider | null;
};

export async function writeReminder({ template, context, provider }: WriteInput): Promise<WrittenReminder> {
  const base = renderTemplate(template, context);
  if (!base.ok) return base;
  const fromTemplate: WrittenReminder = {
    ok: true,
    subject: base.subject,
    bodyMarkdown: base.bodyMarkdown,
    isAiGenerated: false,
  };
  if (!provider) return fromTemplate;

  const values = variableValues(context);
  const request = JSON.stringify({
    ton: TONE_LABELS[template.tone],
    destinataire: context.debtor.clientType === "b2b" ? "professionnel" : "particulier",
    faits: { facture: values.numero_facture, montant: values.montant, echeance: values.date_echeance, retard: values.retard },
    texte: { objet: base.subject, message: base.bodyMarkdown },
  });

  let raw: string | null;
  try {
    raw = await provider.complete({ system: SYSTEM_PROMPT, user: request, maxTokens: MAX_TOKENS });
  } catch {
    return fromTemplate;
  }
  if (!raw) return fromTemplate;

  let answer: z.infer<typeof answerSchema>;
  try {
    const parsed = answerSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return fromTemplate;
    answer = parsed.data;
  } catch {
    return fromTemplate;
  }

  const text = `${answer.objet}\n${answer.message}`;
  // Les faits doivent figurer dans le corps du message (l'objet peut être tronqué ou masqué).
  // Espaces comparées sans distinction (insécable du format monétaire ou espace ordinaire).
  const body = normalizeForRules(answer.message);
  const keepsFacts =
    body.includes(normalizeForRules(values.numero_facture)) && body.includes(normalizeForRules(values.montant));
  const isCompliant =
    findTemplateViolations({ clientType: context.debtor.clientType, subject: answer.objet, body: answer.message }).length === 0;
  if (!keepsFacts || !isCompliant || text.includes("{{")) return fromTemplate;

  return { ok: true, subject: answer.objet, bodyMarkdown: answer.message, isAiGenerated: true };
}
