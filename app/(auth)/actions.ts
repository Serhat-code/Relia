"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/auth/client-ip";
import { authErrorMessage } from "@/lib/auth/errors";
import { readForm, withoutSecrets, type AuthFormState } from "@/lib/auth/form-state";
import { hasRecentRecovery } from "@/lib/auth/recovery";
import { safeNextPath } from "@/lib/auth/redirect";
import {
  finalizeSignupSchema,
  firstFieldErrors,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/auth/schemas";
import { provisionOrganization } from "@/lib/data/organizations";
import { getSessionState } from "@/lib/data/session";
import { getPublicEnv } from "@/lib/env";
import { DPA_VERSION } from "@/lib/legal/dpa";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SIGN_UP_FIELDS = ["fullName", "organizationName", "siren", "email", "password", "dpaAccepted"] as const;

/** Réponse identique qu'un compte existe ou non : on ne révèle pas quelles adresses sont inscrites. */
const checkEmail = (email: string): AuthFormState => ({
  status: "check-email",
  message: `Nous avons envoyé un lien de confirmation à ${email}. Ouvrez-le pour activer votre compte.`,
});

export async function signUpAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readForm(formData, SIGN_UP_FIELDS);
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error), values: withoutSecrets(raw) };
  }
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.fullName },
      emailRedirectTo: `${getPublicEnv().siteUrl}/auth/confirm?next=/app`,
    },
  });

  const isExistingAccount = error?.code === "user_already_exists" || error?.code === "email_exists";
  if (error && !isExistingAccount) {
    return { status: "error", message: authErrorMessage(error.code), values: withoutSecrets(raw) };
  }

  // Un compte déjà existant renvoie un utilisateur sans identité : rien à créer.
  const user = data.user;
  if (user && (user.identities?.length ?? 0) > 0) {
    try {
      await provisionOrganization({
        userId: user.id,
        email: input.email,
        fullName: input.fullName,
        organizationName: input.organizationName,
        siren: input.siren,
        dpaVersion: DPA_VERSION,
        dpaIp: clientIp(await headers()),
      });
    } catch (provisionError: unknown) {
      // Le compte existe : l'utilisateur finalisera son organisation à la connexion (/inscription/finaliser).
      console.error("Provisionnement à l'inscription échoué", provisionError);
    }
  }

  if (data.session) redirect("/app");
  return checkEmail(input.email);
}

export async function signInAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readForm(formData, ["email", "password", "next"]);
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error), values: withoutSecrets(raw) };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: authErrorMessage(error.code), values: withoutSecrets(raw) };

  redirect(safeNextPath(raw.next));
}

export async function forgotPasswordAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readForm(formData, ["email"]);
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: firstFieldErrors(parsed.error), values: raw };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getPublicEnv().siteUrl}/auth/confirm?next=/reinitialiser`,
  });
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return { status: "error", message: authErrorMessage(error.code), values: raw };
  }

  return {
    status: "check-email",
    message: `Si un compte existe pour ${parsed.data.email}, un lien de réinitialisation vient de lui être envoyé.`,
  };
}

export async function resetPasswordAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse(readForm(formData, ["password", "confirmation"]));
  if (!parsed.success) return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  // Seule une session ouverte par le lien reçu par e-mail peut changer le mot de passe ici.
  const { data: auth } = await supabase.auth.getClaims();
  if (!hasRecentRecovery(auth?.claims.amr, Math.floor(Date.now() / 1000))) {
    return { status: "error", message: "Ce lien de réinitialisation a expiré. Demandez-en un nouveau." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: authErrorMessage(error.code) };

  redirect("/app");
}

export async function finalizeSignupAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readForm(formData, ["organizationName", "siren", "dpaAccepted"]);
  const parsed = finalizeSignupSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: firstFieldErrors(parsed.error), values: raw };

  const session = await getSessionState();
  if (session.kind === "anonymous") redirect("/connexion");
  if (session.kind === "member") redirect("/app");

  try {
    await provisionOrganization({
      userId: session.userId,
      email: session.email ?? "",
      fullName: "",
      organizationName: parsed.data.organizationName,
      siren: parsed.data.siren,
      dpaVersion: DPA_VERSION,
      dpaIp: clientIp(await headers()),
    });
  } catch (provisionError: unknown) {
    console.error("Finalisation de l'inscription échouée", provisionError);
    return { status: "error", message: authErrorMessage(undefined), values: raw };
  }
  redirect("/app");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
