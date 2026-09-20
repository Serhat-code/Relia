/** État renvoyé par les Server Actions d'authentification aux formulaires (useActionState). */
export type AuthFormState =
  | { status: "idle" }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | { status: "check-email"; message: string };

export const IDLE_FORM_STATE: AuthFormState = { status: "idle" };

export { readForm } from "@/lib/forms/form-state";

/** Les champs sensibles (mots de passe) ne sont jamais renvoyés au navigateur. */
export function withoutSecrets(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => key !== "password" && key !== "confirmation"),
  );
}
