import { z } from "zod";
import { firstFieldErrors } from "@/lib/forms/form-state";
import { isValidSiren, normalizeSiren } from "@/lib/siren";
import type { ClientType } from "./client-type";

/** Champs de la fiche d'un débiteur, dans l'ordre de l'écran. */
export const DEBTOR_FORM_FIELDS = [
  "name",
  "clientType",
  "legalForm",
  "siren",
  "contactName",
  "contactEmail",
  "phone",
  "address",
  "notes",
] as const;

export type DebtorInput = {
  name: string;
  clientType: ClientType;
  siren: string | null;
  isLegalEntity: boolean;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères au maximum.`)
    .transform((value) => (value === "" ? null : value));

const schema = z
  .object({
    name: z.string().trim().min(1, "Indiquez le nom du client.").max(200, "200 caractères au maximum."),
    clientType: z.enum(["b2b", "b2c"], { error: "Précisez s'il s'agit d'un professionnel ou d'un particulier." }),
    legalForm: z.enum(["legal_entity", "individual"]).catch("individual"),
    // Un SIRET (14 chiffres) commence par le SIREN.
    siren: z
      .string()
      .transform((value) => normalizeSiren(value).slice(0, 9))
      .refine((value) => value === "" || isValidSiren(value), "SIREN invalide : 9 chiffres, clé de contrôle comprise."),
    contactName: optionalText(200),
    contactEmail: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .pipe(z.email("Adresse e-mail invalide.").nullable()),
    phone: optionalText(30).refine((value) => value === null || /^[\d\s+().-]+$/.test(value), "Numéro de téléphone invalide."),
    address: optionalText(500),
    notes: optionalText(2000),
  })
  .transform((values) => {
    // §2.4 : un particulier n'est jamais une personne morale.
    const isLegalEntity = values.clientType === "b2b" && values.legalForm === "legal_entity";
    return {
      name: values.name,
      clientType: values.clientType,
      siren: values.siren === "" ? null : values.siren,
      isLegalEntity,
      contactName: values.contactName,
      contactEmail: values.contactEmail,
      phone: values.phone,
      address: values.address,
      notes: values.notes,
    } satisfies DebtorInput;
  })
  .refine((debtor) => !debtor.isLegalEntity || debtor.siren !== null, {
    message: "Indiquez le SIREN : il identifie la personne morale.",
    path: ["siren"],
  });

export type DebtorFormResult = { ok: true; debtor: DebtorInput } | { ok: false; fieldErrors: Record<string, string> };

export function parseDebtorForm(values: Partial<Record<(typeof DEBTOR_FORM_FIELDS)[number], string>>): DebtorFormResult {
  const withDefaults = Object.fromEntries(DEBTOR_FORM_FIELDS.map((field) => [field, values[field] ?? ""]));
  const parsed = schema.safeParse(withDefaults);
  return parsed.success ? { ok: true, debtor: parsed.data } : { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
}
