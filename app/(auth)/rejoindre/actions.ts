"use server";

import { redirect } from "next/navigation";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth/redirect";
import { acceptInvitation } from "@/lib/data/invitations";
import type { FormState } from "@/lib/forms/form-state";

/**
 * Rejoint une organisation depuis un lien d'invitation. L'acceptation passe par une soumission,
 * jamais par un simple affichage : un aperçu de lien ou un préchargement consommerait sinon le
 * jeton, qui ne sert qu'une fois.
 */
export async function acceptInvitationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("jeton") ?? "").trim();
  if (token === "") return { status: "error", message: "Lien d'invitation incomplet." };

  const result = await acceptInvitation(token);
  if (!result.ok) return { status: "error", message: result.error };

  redirect(DEFAULT_AUTHENTICATED_PATH);
}
