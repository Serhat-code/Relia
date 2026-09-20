import "server-only";
import type { Enums } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Invitations d'équipe (§7). Le jeton n'existe en clair qu'une fois, dans la réponse à la création :
 * la base n'en garde que l'empreinte. Relia n'envoie pas l'invitation — le responsable transmet le
 * lien lui-même, ce qui évite d'ajouter un service d'e-mail au parcours.
 */

export type PendingInvitation = {
  id: string;
  email: string;
  role: Enums<"member_role">;
  expiresAt: string;
  createdAt: string;
};

export type InvitationCreated = { ok: true; token: string } | { ok: false; error: string };
export type InvitationMutation = { ok: true } | { ok: false; error: string };

/**
 * Codes que les fonctions d'invitation emploient pour leurs refus volontaires, chacun accompagné
 * d'un message déjà rédigé en français.
 */
const INTENTIONAL_CODES = new Set(["42501", "22023", "23505", "P0002"]);

/**
 * Ne renvoie au navigateur que les refus que la base a formulés pour l'utilisateur. Un incident
 * imprévu est journalisé côté serveur et remplacé par un message neutre : un texte brut de
 * PostgreSQL exposerait des noms de contraintes et de colonnes (§ palier 15, « jamais error.message »).
 * Les refus volontaires ne portent ni `details` ni `hint` — PostgreSQL, si.
 */
const readError = (
  error: { message: string; code?: string; details?: string | null; hint?: string | null } | null,
  fallback: string,
) => {
  if (!error) return fallback;
  console.error("Invitations : appel refusé", { code: error.code, message: error.message });
  const isIntentional = INTENTIONAL_CODES.has(error.code ?? "") && !error.details && !error.hint;
  return isIntentional ? error.message.trim() : fallback;
};

export async function listPendingInvitations(): Promise<PendingInvitation[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, role, expires_at, created_at")
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Lecture des invitations impossible", { message: error.message });
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export async function createInvitation(email: string, role: Enums<"member_role">): Promise<InvitationCreated> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_invitation", { p_email: email, p_role: role });
  const token = data?.[0]?.token;
  if (error || !token) {
    return { ok: false, error: readError(error, "Invitation impossible pour le moment.") };
  }
  return { ok: true, token };
}

export async function revokeInvitation(invitationId: string): Promise<InvitationMutation> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
  if (error) return { ok: false, error: readError(error, "Annulation impossible pour le moment.") };
  return { ok: true };
}

/** Rejoint l'organisation depuis un lien d'invitation. Renvoie l'organisation rejointe. */
export async function acceptInvitation(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { ok: false, error: readError(error, "Ce lien d'invitation n'est plus valable.") };
  return { ok: true };
}
