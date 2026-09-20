import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { ClientType } from "@/lib/debtors/client-type";
import type { StepDraft } from "@/lib/sequences/steps";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ReminderTone } from "@/lib/templates/system-templates";

/** Scénarios de relance de l'organisation (un par type de client, fournis à l'inscription). */

export type SequenceStep = {
  id: string;
  position: number;
  offsetDays: number;
  tone: ReminderTone;
  templateId: string | null;
  templateName: string | null;
};

export type Sequence = { id: string; name: string; clientType: ClientType; isDefault: boolean; steps: SequenceStep[] };

const SEQUENCE_COLUMNS = `id, name, client_type, is_default,
  reminder_steps (id, position, offset_days, tone, template_id, template:templates (name))`;

type SequenceRow = {
  id: string;
  name: string;
  client_type: ClientType;
  is_default: boolean;
  reminder_steps: Array<{
    id: string;
    position: number;
    offset_days: number;
    tone: ReminderTone;
    template_id: string | null;
    template: { name: string } | null;
  }>;
};

const toSequence = (row: SequenceRow): Sequence => ({
  id: row.id,
  name: row.name,
  clientType: row.client_type,
  isDefault: row.is_default,
  steps: [...row.reminder_steps]
    .sort((a, b) => a.position - b.position)
    .map((step) => ({
      id: step.id,
      position: step.position,
      offsetDays: step.offset_days,
      tone: step.tone,
      templateId: step.template_id,
      templateName: step.template?.name ?? null,
    })),
});

export async function listSequences(): Promise<Sequence[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("reminder_sequences").select(SEQUENCE_COLUMNS).order("client_type");
  if (error) throw new Error(`Lecture des scénarios impossible : ${error.message}`);
  return data.map(toSequence);
}

const uuidSchema = z.uuid();

export const getSequence = cache(async (id: string): Promise<Sequence | null> => {
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("reminder_sequences").select(SEQUENCE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Lecture du scénario impossible : ${error.message}`);
  return data ? toSequence(data) : null;
});

export type SaveStepsResult = { ok: true } | { ok: false; error: string };

/** Enregistre toutes les étapes d'un coup ; la base revérifie les règles (public.save_sequence_steps). */
export async function saveSequenceSteps(sequenceId: string, steps: readonly StepDraft[]): Promise<SaveStepsResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_sequence_steps", {
    p_sequence_id: sequenceId,
    p_steps: steps.map((step) => ({
      id: step.id,
      offset_days: step.offsetDays,
      tone: step.tone,
      template_id: step.templateId,
    })),
  });
  if (!error) return { ok: true };
  console.error("Enregistrement d'un scénario refusé par la base", { code: error.code, message: error.message });
  if (error.code === "P0002") return { ok: false, error: "Scénario introuvable. Rechargez la page." };
  if (error.code === "23514") return { ok: false, error: "Un modèle choisi ne correspond pas au ton ou au type de client." };
  return { ok: false, error: "Le scénario n'a pas pu être enregistré." };
}
