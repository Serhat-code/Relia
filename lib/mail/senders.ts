import "server-only";
import nodemailer from "nodemailer";
import { z } from "zod";
import { isAuthFailure, requestProvider } from "./http";
import { buildMimeMessage, type OutgoingMessage } from "./message";
import { newMessageId } from "./message-id";
import { resolvePublicMailHost } from "./smtp-guard";

/**
 * Envoi par la boîte du client (§2.1) : API Gmail, Microsoft Graph ou son propre serveur SMTP.
 * Jamais depuis un domaine Relia.
 */

export type SendResult =
  | { ok: true; providerMessageId: string | null; threadId: string | null }
  | { ok: false; error: string; isAuthError: boolean };

const unreachable = (provider: string): SendResult => ({
  ok: false,
  error: `${provider} injoignable (délai dépassé ou erreur réseau).`,
  isAuthError: false,
});

export async function sendWithGmail(accessToken: string, message: OutgoingMessage): Promise<SendResult> {
  const raw = (await buildMimeMessage(message)).toString("base64url");
  const response = await requestProvider("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!response) return unreachable("Gmail");
  if (!response.ok) {
    return { ok: false, error: `Gmail a refusé l'envoi (${response.status}).`, isAuthError: isAuthFailure(response.status) };
  }
  const parsed = z.object({ id: z.string(), threadId: z.string().optional() }).safeParse(await response.json().catch(() => null));
  return { ok: true, providerMessageId: parsed.data?.id ?? null, threadId: parsed.data?.threadId ?? null };
}

/**
 * Microsoft Graph : brouillon puis envoi, pour connaître l'identifiant du message et de la
 * conversation (rattachement des réponses). Identifiants immuables : ils survivent au classement.
 */
export async function sendWithGraph(accessToken: string, message: OutgoingMessage): Promise<SendResult> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Prefer: 'IdType="ImmutableId"',
  };
  const draft = await requestProvider("https://graph.microsoft.com/v1.0/me/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      subject: message.subject,
      body: { contentType: "HTML", content: message.html },
      toRecipients: [{ emailAddress: { address: message.to } }],
    }),
  });
  if (!draft) return unreachable("Outlook");
  if (!draft.ok) {
    return { ok: false, error: `Outlook a refusé le message (${draft.status}).`, isAuthError: isAuthFailure(draft.status) };
  }
  const created = z
    .object({ id: z.string(), conversationId: z.string().optional() })
    .safeParse(await draft.json().catch(() => null));
  if (!created.success) return { ok: false, error: "Réponse inattendue d'Outlook.", isAuthError: false };

  const sent = await requestProvider(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(created.data.id)}/send`, {
    method: "POST",
    headers,
  });
  if (!sent) return unreachable("Outlook");
  if (!sent.ok) {
    return { ok: false, error: `Outlook a refusé l'envoi (${sent.status}).`, isAuthError: isAuthFailure(sent.status) };
  }
  return { ok: true, providerMessageId: created.data.id, threadId: created.data.conversationId ?? null };
}

export type SmtpSettings = { host: string; port: number; user: string; password: string };

const SMTP_TIMEOUT_MS = 10_000;

async function smtpTransport(settings: SmtpSettings) {
  const address = await resolvePublicMailHost(settings.host);
  if (!address) return null;
  return nodemailer.createTransport({
    // Connexion à l'adresse vérifiée ; le nom sert à la vérification du certificat TLS.
    host: address,
    port: settings.port,
    secure: settings.port === 465,
    requireTLS: settings.port !== 465,
    tls: { servername: settings.host, minVersion: "TLSv1.2" },
    auth: { user: settings.user, pass: settings.password },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
}

const UNREACHABLE = "Serveur SMTP introuvable ou non autorisé (seules les adresses publiques sont acceptées).";

/** Vérifie l'accès (connexion TLS et authentification) sans rien envoyer. */
export async function verifySmtp(settings: SmtpSettings): Promise<{ ok: true } | { ok: false; error: string }> {
  const transport = await smtpTransport(settings);
  if (!transport) return { ok: false, error: UNREACHABLE };
  try {
    await transport.verify();
    return { ok: true };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    return {
      ok: false,
      error:
        code === "EAUTH"
          ? "Le serveur SMTP a refusé l'identifiant ou le mot de passe."
          : "Connexion au serveur SMTP impossible : vérifiez le serveur et le port.",
    };
  } finally {
    transport.close();
  }
}

/**
 * Envoi par le serveur SMTP du client. L'identifiant du message est choisi ici et conservé : les
 * réponses, lues en IMAP, le citent (palier 11).
 */
export async function sendWithSmtp(settings: SmtpSettings, message: OutgoingMessage): Promise<SendResult> {
  const transport = await smtpTransport(settings);
  if (!transport) return { ok: false, error: UNREACHABLE, isAuthError: false };
  const messageId = message.messageId ?? newMessageId(message.from.address);
  try {
    await transport.sendMail({
      envelope: { from: message.from.address, to: message.to },
      raw: await buildMimeMessage({ ...message, messageId }),
    });
    return { ok: true, providerMessageId: messageId, threadId: messageId };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    return { ok: false, error: "Le serveur SMTP a refusé l'envoi.", isAuthError: code === "EAUTH" };
  } finally {
    transport.close();
  }
}
