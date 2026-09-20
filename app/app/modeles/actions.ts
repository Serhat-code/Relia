"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/data/session";
import { copyTemplate, deleteTemplate, getTemplate, updateTemplate } from "@/lib/data/templates";
import { readForm, type FormState } from "@/lib/forms/form-state";
import { parseTemplateForm, TEMPLATE_FORM_FIELDS } from "@/lib/templates/template-form";

/** Modèles personnalisés. Chaque action vérifie la session ; la base revérifie les règles de contenu. */

const templateIdSchema = z.object({ templateId: z.uuid() });

function refreshTemplatePages(templateId?: string) {
  revalidatePath("/app/modeles");
  revalidatePath("/app/scenarios", "layout");
  if (templateId) revalidatePath(`/app/modeles/${templateId}`);
}

export type TemplateActionResult = { ok: false; error: string };

/** Copie modifiable d'un modèle système, puis ouverture de l'éditeur. */
export async function copyTemplateAction(input: unknown): Promise<TemplateActionResult> {
  const member = await requireMember();
  const parsed = templateIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };

  const result = await copyTemplate(parsed.data.templateId, member.organization.id);
  if (!result.ok) return result;
  refreshTemplatePages();
  redirect(`/app/modeles/${result.value}`);
}

/** Liée à l'identifiant du modèle côté page : `updateTemplateAction.bind(null, id)`. */
export async function updateTemplateAction(templateId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireMember();
  const template = await getTemplate(templateId);
  if (!template || template.isSystem) return { status: "error", message: "Ce modèle ne peut pas être modifié." };

  const values = readForm(formData, TEMPLATE_FORM_FIELDS);
  const parsed = parseTemplateForm(values, template.clientType);
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors, values };

  const result = await updateTemplate(templateId, parsed.template);
  if (!result.ok) return { status: "error", message: result.error, values };
  refreshTemplatePages(templateId);
  return { status: "success", message: "Modèle enregistré." };
}

export async function deleteTemplateAction(input: unknown): Promise<TemplateActionResult> {
  await requireMember();
  const parsed = templateIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  const template = await getTemplate(parsed.data.templateId);
  if (!template || template.isSystem) return { ok: false, error: "Ce modèle ne peut pas être supprimé." };

  const result = await deleteTemplate(parsed.data.templateId);
  if (!result.ok) return result;
  refreshTemplatePages();
  redirect(template.clientType === "b2c" ? "/app/modeles?type=particuliers" : "/app/modeles");
}
