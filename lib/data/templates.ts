import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { ClientType } from "@/lib/debtors/client-type";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ReminderTone } from "@/lib/templates/system-templates";
import type { TemplateInput } from "@/lib/templates/template-form";

/** Modèles de relance visibles par l'organisation : modèles système (lecture seule) et les siens. */

export type TemplateItem = {
  id: string;
  name: string;
  clientType: ClientType;
  tone: ReminderTone;
  subject: string;
  bodyMarkdown: string;
  isSystem: boolean;
  /** Étapes de scénario qui l'utilisent (un modèle utilisé garde son ton et son type de client). */
  usageCount: number;
};

const TEMPLATE_COLUMNS = "id, name, client_type, tone, subject, body_markdown, is_system, reminder_steps (count)";

type TemplateRow = {
  id: string;
  name: string;
  client_type: ClientType;
  tone: ReminderTone;
  subject: string;
  body_markdown: string;
  is_system: boolean;
  reminder_steps: Array<{ count: number }>;
};

const toItem = (row: TemplateRow): TemplateItem => ({
  id: row.id,
  name: row.name,
  clientType: row.client_type,
  tone: row.tone,
  subject: row.subject,
  bodyMarkdown: row.body_markdown,
  isSystem: row.is_system,
  usageCount: row.reminder_steps[0]?.count ?? 0,
});

const TONE_ORDER: Readonly<Record<ReminderTone, number>> = { courtois: 0, ferme: 1, mise_en_demeure: 2 };

export async function listTemplates(clientType: ClientType): Promise<TemplateItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("templates")
    .select(TEMPLATE_COLUMNS)
    .eq("client_type", clientType)
    .order("is_system", { ascending: false })
    .order("name");
  if (error) throw new Error(`Lecture des modèles impossible : ${error.message}`);
  return data
    .map(toItem)
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || Number(b.isSystem) - Number(a.isSystem));
}

const uuidSchema = z.uuid();

export const getTemplate = cache(async (id: string): Promise<TemplateItem | null> => {
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("templates").select(TEMPLATE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Lecture du modèle impossible : ${error.message}`);
  return data ? toItem(data) : null;
});

export type TemplateMutation<T> = { ok: true; value: T } | { ok: false; error: string };

const SAVE_FAILED = "Le modèle n'a pas pu être enregistré.";

/** Copie modifiable d'un modèle (système ou personnalisé), dans l'organisation du membre. */
export async function copyTemplate(sourceId: string, organizationId: string): Promise<TemplateMutation<string>> {
  const source = await getTemplate(sourceId);
  if (!source) return { ok: false, error: "Modèle introuvable." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("templates")
    .insert({
      organization_id: organizationId,
      name: `${source.name} (personnalisé)`.slice(0, 200),
      client_type: source.clientType,
      tone: source.tone,
      subject: source.subject,
      body_markdown: source.bodyMarkdown,
    })
    .select("id")
    .single();
  if (error) {
    console.error("Copie d'un modèle refusée par la base", { code: error.code, message: error.message });
    return { ok: false, error: SAVE_FAILED };
  }
  return { ok: true, value: data.id };
}

export async function updateTemplate(id: string, input: TemplateInput): Promise<TemplateMutation<null>> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Modèle introuvable." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("templates")
    .update({ name: input.name, subject: input.subject, body_markdown: input.bodyMarkdown, variables: input.variables })
    .eq("id", id)
    .eq("is_system", false)
    .select("id");
  if (error) {
    console.error("Modification d'un modèle refusée par la base", { code: error.code, message: error.message });
    // 23514 : règles de contenu (liste noire) vérifiées aussi par la base.
    return { ok: false, error: error.code === "23514" ? "Ce texte enfreint les règles des relances." : SAVE_FAILED };
  }
  return data.length > 0 ? { ok: true, value: null } : { ok: false, error: "Modèle introuvable." };
}

/** Les étapes qui l'utilisaient se retrouvent sans modèle : elles utilisent alors le modèle système du même ton. */
export async function deleteTemplate(id: string): Promise<TemplateMutation<null>> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Modèle introuvable." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("templates").delete().eq("id", id).eq("is_system", false).select("id");
  if (error) {
    console.error("Suppression d'un modèle refusée par la base", { code: error.code, message: error.message });
    return { ok: false, error: "Le modèle n'a pas pu être supprimé." };
  }
  return data.length > 0 ? { ok: true, value: null } : { ok: false, error: "Modèle introuvable." };
}
