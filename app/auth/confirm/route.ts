import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Types de liens réellement envoyés par Relia (emails/auth) ; les autres sont refusés. */
const EMAIL_OTP_TYPES: ReadonlySet<string> = new Set(["signup", "email", "recovery", "email_change"]);

const isEmailOtpType = (value: string | null): value is EmailOtpType => value !== null && EMAIL_OTP_TYPES.has(value);

/**
 * Lien reçu par e-mail (confirmation d'adresse, réinitialisation du mot de passe) :
 * vérifie le jeton, ouvre la session, puis renvoie vers la page prévue.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (tokenHash && isEmailOtpType(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(safeNextPath(searchParams.get("next")));
  }

  redirect("/connexion?erreur=lien-invalide");
}
