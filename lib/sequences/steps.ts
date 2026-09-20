import { z } from "zod";
import type { ReminderTone } from "@/lib/templates/system-templates";

/**
 * Étapes d'un scénario de relance, déclenchées en jours relatifs à l'échéance (§5.3).
 * Mêmes règles que public.save_sequence_steps, qui les applique aussi en base.
 */

export const MAX_STEPS = 8;
export const MIN_OFFSET_DAYS = -60;
export const MAX_OFFSET_DAYS = 365;

export const REMINDER_TONES = ["courtois", "ferme", "mise_en_demeure"] as const satisfies readonly ReminderTone[];

export type StepDraft = { id: string | null; offsetDays: number; tone: ReminderTone; templateId: string | null };

export type StepsValidation = { ok: true } | { ok: false; message: string; stepErrors: Record<number, string> };

export function validateSteps(steps: readonly StepDraft[]): StepsValidation {
  if (steps.length < 1 || steps.length > MAX_STEPS) {
    return { ok: false, message: `Un scénario compte de 1 à ${MAX_STEPS} étapes.`, stepErrors: {} };
  }

  const stepErrors: Record<number, string> = {};
  steps.forEach((step, index) => {
    const previous = steps[index - 1];
    if (!Number.isInteger(step.offsetDays) || step.offsetDays < MIN_OFFSET_DAYS || step.offsetDays > MAX_OFFSET_DAYS) {
      stepErrors[index] = "Entre 60 jours avant et 365 jours après l'échéance.";
    } else if (previous && step.offsetDays <= previous.offsetDays) {
      stepErrors[index] = "Chaque étape doit venir après la précédente.";
    } else if (step.tone !== "courtois" && step.offsetDays < 1) {
      stepErrors[index] = "Un ton ferme ou une mise en demeure vient après l'échéance.";
    }
  });

  return Object.keys(stepErrors).length === 0
    ? { ok: true }
    : { ok: false, message: "Corrigez les étapes signalées.", stepErrors };
}

/** « 3 jours avant l'échéance », « le jour de l'échéance », « 15 jours après l'échéance ». */
export function describeOffset(offsetDays: number): string {
  if (offsetDays === 0) return "le jour de l'échéance";
  const days = Math.abs(offsetDays);
  const unit = days >= 2 ? "jours" : "jour";
  return `${days} ${unit} ${offsetDays < 0 ? "avant" : "après"} l'échéance`;
}

/** Libellé court pour une frise : « J-3 », « J », « J+15 ». */
export function shortOffset(offsetDays: number): string {
  if (offsetDays === 0) return "J";
  return offsetDays < 0 ? `J${offsetDays}` : `J+${offsetDays}`;
}

export const saveStepsInputSchema = z.object({
  sequenceId: z.uuid(),
  steps: z
    .array(
      z.object({
        id: z.uuid().nullable(),
        offsetDays: z.number().int(),
        tone: z.enum(REMINDER_TONES),
        templateId: z.uuid().nullable(),
      }),
    )
    .max(MAX_STEPS),
});
