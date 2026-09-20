import { z } from "zod";
import { DEFAULT_CURRENCY, isKnownCurrency } from "@/lib/currency";
import { firstFieldErrors } from "@/lib/forms/form-state";
import { isValidSiren, normalizeSiren } from "@/lib/siren";

/**
 * Réglages de l'organisation (§7) : identité, devise de travail et durée de conservation des
 * données (§2.2).
 */

export const ORGANIZATION_FORM_FIELDS = ["name", "siren", "currency"] as const;

/** Durées de conservation proposées, en mois après la clôture d'une facture (3 ans par défaut). */
export const RETENTION_OPTIONS = [
  { months: 12, label: "1 an" },
  { months: 24, label: "2 ans" },
  { months: 36, label: "3 ans (recommandé)" },
  { months: 60, label: "5 ans" },
  { months: 120, label: "10 ans" },
] as const;

const organizationSchema = z.object({
  name: z.string().trim().min(2, "Indiquez le nom de votre entreprise.").max(120, "120 caractères au maximum."),
  siren: z
    .string()
    .transform(normalizeSiren)
    .refine((value) => value === "" || isValidSiren(value), "SIREN invalide : 9 chiffres."),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isKnownCurrency, "Devise inconnue : indiquez un code ISO à 3 lettres, par exemple EUR."),
});

export type OrganizationSettings = { name: string; siren: string | null; currency: string };

export type OrganizationFormResult = { ok: true; value: OrganizationSettings } | { ok: false; fieldErrors: Record<string, string> };

export function parseOrganizationForm(values: Partial<Record<(typeof ORGANIZATION_FORM_FIELDS)[number], string>>): OrganizationFormResult {
  const parsed = organizationSchema.safeParse({
    name: values.name ?? "",
    siren: values.siren ?? "",
    currency: values.currency || DEFAULT_CURRENCY,
  });
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
  return { ok: true, value: { name: parsed.data.name, siren: parsed.data.siren || null, currency: parsed.data.currency } };
}

export function parseRetention(value: string | undefined): number | null {
  const months = Number(value);
  return RETENTION_OPTIONS.some((option) => option.months === months) ? months : null;
}

/** Confirmation d'effacement : le nom de l'organisation, saisi sans tenir compte de la casse ni des espaces. */
export function confirmsOrganizationName(typed: string, name: string): boolean {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
  return typed.trim() !== "" && normalize(typed) === normalize(name);
}

/** Rôles qu'une invitation peut accorder : jamais « propriétaire », qui se transmet à part. */
export const INVITE_ROLES = [
  { value: "member", label: "Membre — consulte et traite les relances" },
  { value: "admin", label: "Administrateur — gère aussi les réglages et la boîte d'envoi" },
] as const;
