import { z } from "zod";
import { firstFieldErrors } from "@/lib/forms/form-state";
import { IMAP_PORT, isAllowedImapPort, isAllowedSmtpPort } from "./smtp-ports";

/**
 * Repli SMTP (§2.1) : le client utilise son propre serveur d'envoi. Le serveur IMAP, facultatif,
 * permet de lire les réponses de ses clients (palier 11), avec les mêmes identifiants.
 */

export const SMTP_FORM_FIELDS = ["host", "port", "user", "password", "emailAddress", "displayName", "imapHost", "imapPort"] as const;

/** Messageries courantes des TPE françaises (réglages publics des hébergeurs). */
export const SMTP_PRESETS = [
  { label: "OVHcloud", host: "ssl0.ovh.net", port: 465, imapHost: "ssl0.ovh.net" },
  { label: "IONOS", host: "smtp.ionos.fr", port: 465, imapHost: "imap.ionos.fr" },
  { label: "Infomaniak", host: "mail.infomaniak.com", port: 465, imapHost: "mail.infomaniak.com" },
  { label: "Gandi", host: "mail.gandi.net", port: 465, imapHost: "mail.gandi.net" },
  { label: "Orange", host: "smtp.orange.fr", port: 465, imapHost: "imap.orange.fr" },
  { label: "Free", host: "smtp.free.fr", port: 465, imapHost: "imap.free.fr" },
  { label: "SFR", host: "smtp.sfr.fr", port: 465, imapHost: "imap.sfr.fr" },
  { label: "Zoho Mail (UE)", host: "smtp.zoho.eu", port: 465, imapHost: "imap.zoho.eu" },
  // GMX : l'accès par un logiciel externe est refusé tant qu'il n'est pas activé dans le compte
  // (Paramètres → POP3 & IMAP) ; sans cela le serveur rejette le mot de passe, même s'il est bon.
  { label: "GMX", host: "mail.gmx.com", port: 465, imapHost: "imap.gmx.com" },
] as const;

export type SmtpFormSettings = {
  host: string;
  port: number;
  user: string;
  password: string;
  emailAddress: string;
  displayName: string;
  /** Null : les réponses ne sont pas lues (le client les traite dans sa messagerie). */
  imapHost: string | null;
  imapPort: number | null;
};

const HOSTNAME = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const HOSTNAME_ERROR = "Nom de serveur invalide (exemple : ssl0.ovh.net).";

const schema = z
  .object({
    host: z.string().trim().toLowerCase().regex(HOSTNAME, HOSTNAME_ERROR),
    port: z.coerce.number().int().refine(isAllowedSmtpPort, "Port de messagerie attendu : 465, 587, 25 ou 2525."),
    user: z.string().trim().min(1, "Indiquez l'identifiant.").max(200, "200 caractères au maximum."),
    // Un mot de passe peut commencer ou finir par une espace : il n'est jamais retouché.
    password: z.string().min(1, "Indiquez le mot de passe.").max(500, "500 caractères au maximum."),
    emailAddress: z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide.")),
    displayName: z.string().trim().min(1, "Indiquez le nom d'expéditeur.").max(100, "100 caractères au maximum."),
    imapHost: z
      .string()
      .trim()
      .toLowerCase()
      .refine((value) => value === "" || HOSTNAME.test(value), HOSTNAME_ERROR),
    imapPort: z.string().trim(),
  })
  .superRefine((values, context) => {
    if (values.imapHost !== "" && !isAllowedImapPort(Number(values.imapPort || IMAP_PORT))) {
      context.addIssue({ code: "custom", path: ["imapPort"], message: `Port IMAP attendu : ${IMAP_PORT} (connexion chiffrée).` });
    }
  });

export type SmtpFormResult = { ok: true; settings: SmtpFormSettings } | { ok: false; fieldErrors: Record<string, string> };

export function parseSmtpForm(values: Partial<Record<(typeof SMTP_FORM_FIELDS)[number], string>>): SmtpFormResult {
  const parsed = schema.safeParse(Object.fromEntries(SMTP_FORM_FIELDS.map((field) => [field, values[field] ?? ""])));
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
  const { imapHost, imapPort, ...smtp } = parsed.data;
  const readsReplies = imapHost !== "";
  return {
    ok: true,
    settings: { ...smtp, imapHost: readsReplies ? imapHost : null, imapPort: readsReplies ? Number(imapPort || IMAP_PORT) : null },
  };
}
