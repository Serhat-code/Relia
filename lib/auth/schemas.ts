import { z } from "zod";
import { isValidSiren, normalizeSiren } from "@/lib/siren";

/** Schémas des formulaires d'authentification (validation côté serveur, messages en français). */

const emailField = z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide."));

// 72 caractères : au-delà, bcrypt (utilisé par Supabase Auth) ignore la fin du mot de passe.
const newPasswordField = z
  .string()
  .min(10, "Au moins 10 caractères.")
  .max(72, "72 caractères au maximum.")
  .regex(/\p{L}/u, "Au moins une lettre.")
  .regex(/\d/, "Au moins un chiffre.");

const sirenField = z.preprocess(
  (value) => (typeof value === "string" ? normalizeSiren(value) : ""),
  z.union([
    z.literal(""),
    z.string().refine(isValidSiren, "SIREN invalide : 9 chiffres, clé de contrôle comprise."),
  ]),
);

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Indiquez votre nom.").max(200, "200 caractères au maximum."),
  organizationName: z
    .string()
    .trim()
    .min(1, "Indiquez le nom de votre entreprise.")
    .max(200, "200 caractères au maximum."),
  siren: sirenField,
  email: emailField,
  password: newPasswordField,
  dpaAccepted: z.literal("on", { error: "Vous devez accepter l'accord de sous-traitance (DPA) pour continuer." }),
});

/** Inscription interrompue : le compte existe, il reste l'organisation et l'acceptation du DPA. */
export const finalizeSignupSchema = signUpSchema.pick({ organizationName: true, siren: true, dpaAccepted: true });

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Indiquez votre mot de passe."),
});

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({ password: newPasswordField, confirmation: z.string() })
  .refine((values) => values.password === values.confirmation, {
    message: "Les deux mots de passe ne correspondent pas.",
    path: ["confirmation"],
  });

export { firstFieldErrors } from "@/lib/forms/form-state";
