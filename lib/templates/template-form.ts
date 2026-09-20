import { z } from "zod";
import { findTemplateViolations } from "@/lib/compliance/template-rules";
import type { ClientType } from "@/lib/debtors/client-type";
import { firstFieldErrors } from "@/lib/forms/form-state";
import { extractVariables, TEMPLATE_VARIABLES } from "./engine";

export const TEMPLATE_FORM_FIELDS = ["name", "subject", "bodyMarkdown"] as const;

export type TemplateInput = { name: string; subject: string; bodyMarkdown: string; variables: string[] };

export type TemplateFormResult = { ok: true; template: TemplateInput } | { ok: false; fieldErrors: Record<string, string> };

const schema = z.object({
  name: z.string().trim().min(1, "Donnez un nom au modèle.").max(200, "200 caractères au maximum."),
  subject: z.string().trim().min(1, "Indiquez l'objet du message.").max(200, "200 caractères au maximum."),
  bodyMarkdown: z.string().trim().min(1, "Rédigez le message.").max(5000, "5 000 caractères au maximum."),
});

/** Modèle personnalisé : champs, variables connues, puis règles de contenu (§2.1, §2.5, §2.6). */
export function parseTemplateForm(
  values: Partial<Record<(typeof TEMPLATE_FORM_FIELDS)[number], string>>,
  clientType: ClientType,
): TemplateFormResult {
  const parsed = schema.safeParse({
    name: values.name ?? "",
    subject: values.subject ?? "",
    bodyMarkdown: values.bodyMarkdown ?? "",
  });
  const fieldErrors = parsed.success ? {} : firstFieldErrors(parsed.error);

  const subject = (values.subject ?? "").trim();
  const bodyMarkdown = (values.bodyMarkdown ?? "").trim();
  const variables = extractVariables(`${subject}\n${bodyMarkdown}`);
  const unknown = variables.find((name) => !Object.hasOwn(TEMPLATE_VARIABLES, name));
  const violations = findTemplateViolations({ clientType, subject, body: bodyMarkdown });

  const bodyError = unknown ? `Variable inconnue : {{${unknown}}}.` : violations.join(" ");
  if (bodyError && !fieldErrors.bodyMarkdown) fieldErrors.bodyMarkdown = bodyError;

  if (!parsed.success || Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, template: { ...parsed.data, variables } };
}
