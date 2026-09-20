"use server";

import { revalidatePath } from "next/cache";
import { disconnectMailbox, getMailbox, saveSmtpMailbox } from "@/lib/data/mailbox";
import { requireMember } from "@/lib/data/session";
import { readForm, type FormState } from "@/lib/forms/form-state";
import { sendFromOrganizationMailbox } from "@/lib/mail/mailbox-sender";
import { verifyImap } from "@/lib/mail/imap";
import { verifySmtp } from "@/lib/mail/senders";
import { parseSmtpForm, SMTP_FORM_FIELDS } from "@/lib/mail/smtp-form";
import { isRateLimited, RATE_LIMITS, recordAttempt } from "@/lib/data/rate-limit";

/** Boîte d'envoi (§2.1). Connexion et déconnexion réservées au propriétaire et aux administrateurs. */

const ROLE_ERROR = "Seuls le propriétaire et les administrateurs peuvent gérer la boîte d'envoi.";
const RATE_LIMIT_ERROR = "Trop d'essais rapprochés : réessayez dans une dizaine de minutes.";

function refreshMailboxPages() {
  revalidatePath("/app/boite-mail");
  revalidatePath("/app");
}

export async function connectSmtpAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  if (member.role === "member") return { status: "error", message: ROLE_ERROR };

  const values = readForm(formData, SMTP_FORM_FIELDS);
  // Le mot de passe n'est jamais renvoyé au navigateur.
  const safeValues = Object.fromEntries(Object.entries(values).filter(([key]) => key !== "password"));
  const parsed = parseSmtpForm(values);
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors, values: safeValues };

  const { settings } = parsed;
  if (await isRateLimited(member.organization.id, RATE_LIMITS.smtpCheck)) {
    return { status: "error", message: RATE_LIMIT_ERROR, values: safeValues };
  }
  const credentials = { user: settings.user, password: settings.password };
  const check = await verifySmtp({ host: settings.host, port: settings.port, ...credentials });
  // Lecture des réponses : le serveur IMAP est vérifié avec les mêmes identifiants.
  const imapCheck =
    check.ok && settings.imapHost && settings.imapPort
      ? await verifyImap({ host: settings.imapHost, port: settings.imapPort, ...credentials })
      : ({ ok: true } as const);
  await recordAttempt(member.organization.id, member.id, RATE_LIMITS.smtpCheck, {
    host: settings.host,
    ok: check.ok && imapCheck.ok,
    ...(settings.imapHost ? { imap_host: settings.imapHost } : {}),
  });
  if (!check.ok) return { status: "error", message: check.error, values: safeValues };
  if (!imapCheck.ok) return { status: "error", message: imapCheck.error, values: safeValues };

  const result = await saveSmtpMailbox({ organizationId: member.organization.id, userId: member.id }, settings);
  if (!result.ok) return { status: "error", message: result.error, values: safeValues };
  refreshMailboxPages();
  return {
    status: "success",
    message: settings.imapHost
      ? "Boîte d'envoi connectée, réponses lues automatiquement. Envoyez-vous un e-mail de test pour vérifier."
      : "Boîte d'envoi connectée. Envoyez-vous un e-mail de test pour vérifier.",
  };
}

export type MailboxActionResult = { ok: true; message: string } | { ok: false; error: string };

/** E-mail de test envoyé à la boîte elle-même : le client voit ce que recevront ses clients. */
export async function sendTestEmailAction(): Promise<MailboxActionResult> {
  const member = await requireMember();
  const mailbox = await getMailbox();
  if (!mailbox) return { ok: false, error: "Aucune boîte d'envoi n'est connectée." };
  if (await isRateLimited(member.organization.id, RATE_LIMITS.mailboxTest)) return { ok: false, error: RATE_LIMIT_ERROR };

  const text = [
    "Bonjour,",
    "",
    "Ce message de test a été envoyé par Relia depuis votre propre boîte e-mail.",
    "Vos relances partiront de la même façon : de votre adresse, à votre nom, et les réponses de vos clients arriveront directement chez vous.",
    "",
    "Relia",
  ].join("\n");
  const result = await sendFromOrganizationMailbox(
    member.organization.id,
    {
      to: mailbox.emailAddress,
      subject: "Relia : votre boîte d'envoi fonctionne",
      text,
      html: text
        .split("\n\n")
        .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
        .join(""),
    },
    member.organization.name,
  );
  await recordAttempt(member.organization.id, member.id, RATE_LIMITS.mailboxTest, { ok: result.ok });
  refreshMailboxPages();
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, message: `E-mail de test envoyé à ${mailbox.emailAddress}.` };
}

export async function disconnectMailboxAction(): Promise<MailboxActionResult> {
  const member = await requireMember();
  if (member.role === "member") return { ok: false, error: ROLE_ERROR };
  const result = await disconnectMailbox({ organizationId: member.organization.id, userId: member.id });
  if (!result.ok) return result;
  refreshMailboxPages();
  return { ok: true, message: "Boîte d'envoi déconnectée. Relia n'a plus aucun accès à votre messagerie." };
}
