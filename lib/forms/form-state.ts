import { z } from "zod";

/** État renvoyé par une Server Action à son formulaire (useActionState). */
export type FormState =
  | { status: "idle" }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | { status: "success"; message: string };

export const IDLE_STATE: FormState = { status: "idle" };

/** Valeurs texte d'un formulaire, pour la validation puis le réaffichage après une erreur. */
export function readForm(formData: FormData, keys: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = formData.get(key);
      return typeof value === "string" ? [[key, value]] : [];
    }),
  );
}

/** Premier message d'erreur par champ, pour l'affichage sous chaque champ. */
export function firstFieldErrors(error: z.ZodError | undefined): Record<string, string> {
  if (!error) return {};
  return Object.fromEntries(
    Object.entries(z.flattenError(error).fieldErrors).flatMap(([field, messages]) => {
      const first = (messages as string[] | undefined)?.[0];
      return first ? [[field, first]] : [];
    }),
  );
}
