import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Jeu d'essai (§1, « prise en main en moins de 10 minutes »). Un compte neuf est vide : sans
 * données, on ne voit pas Relia travailler et l'on abandonne avant d'avoir préparé un CSV.
 *
 * Le client fictif porte l'adresse du membre : la relance lui revient, il peut y répondre, et la
 * boucle complète se teste sans impliquer un vrai client.
 */

export type SampleMutation = { ok: true; message: string } | { ok: false; error: string };

/** Les refus volontaires de la base sont rédigés en français ; le reste est un incident à taire. */
const INTENTIONAL_CODES = new Set(["42501", "23505"]);

function readError(
  error: { message: string; code?: string; details?: string | null; hint?: string | null } | null,
  fallback: string,
): string {
  if (!error) return fallback;
  console.error("Jeu d'essai : appel refusé", { code: error.code, message: error.message });
  const isIntentional = INTENTIONAL_CODES.has(error.code ?? "") && !error.details && !error.hint;
  return isIntentional ? error.message.trim() : fallback;
}

export async function loadSampleData(): Promise<SampleMutation> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("load_sample_data");
  if (error) return { ok: false, error: readError(error, "Chargement du jeu d'essai impossible pour le moment.") };
  return { ok: true, message: "Jeu d'essai chargé : cinq factures et un client à votre adresse." };
}

export async function clearSampleData(): Promise<SampleMutation> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("clear_sample_data");
  if (error) return { ok: false, error: readError(error, "Effacement du jeu d'essai impossible pour le moment.") };
  return { ok: true, message: `Jeu d'essai effacé (${data ?? 0} factures). Vos vraies données sont intactes.` };
}
