"use server";

import { revalidatePath } from "next/cache";
import { saveSequenceSteps } from "@/lib/data/sequences";
import { requireMember } from "@/lib/data/session";
import { saveStepsInputSchema, validateSteps } from "@/lib/sequences/steps";

export type SaveStepsActionResult = { ok: true } | { ok: false; error: string; stepErrors?: Record<number, string> };

/** Enregistre les étapes d'un scénario ; mêmes règles ici et dans la base. */
export async function saveStepsAction(input: unknown): Promise<SaveStepsActionResult> {
  await requireMember();
  const parsed = saveStepsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Étapes invalides." };

  const validation = validateSteps(parsed.data.steps);
  if (!validation.ok) return { ok: false, error: validation.message, stepErrors: validation.stepErrors };

  const result = await saveSequenceSteps(parsed.data.sequenceId, parsed.data.steps);
  if (!result.ok) return result;
  revalidatePath("/app/scenarios");
  revalidatePath(`/app/scenarios/${parsed.data.sequenceId}`);
  revalidatePath("/app/modeles");
  return { ok: true };
}
