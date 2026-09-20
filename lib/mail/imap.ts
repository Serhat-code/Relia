import "server-only";
import { ImapFlow } from "imapflow";
import { resolvePublicMailHost } from "./smtp-guard";

/**
 * Lecture des réponses en repli SMTP : connexion IMAP à la messagerie du client (TLS implicite,
 * port 993), avec ses identifiants. Même garde que pour le SMTP : seules les adresses publiques sont
 * acceptées, et la connexion se fait à l'adresse vérifiée (le nom ne sert qu'au certificat).
 */

export type ImapSettings = { host: string; port: number; user: string; password: string };

const IMAP_TIMEOUT_MS = 10_000;

export const IMAP_UNREACHABLE = "Serveur IMAP introuvable ou non autorisé (seules les adresses publiques sont acceptées).";

/** Client connecté, ou null si le serveur ne résout pas vers une adresse publique. Lève si la connexion échoue. */
export async function openImap(settings: ImapSettings): Promise<ImapFlow | null> {
  const address = await resolvePublicMailHost(settings.host);
  if (!address) return null;
  const client = new ImapFlow({
    host: address,
    port: settings.port,
    secure: true,
    servername: settings.host,
    tls: { servername: settings.host, minVersion: "TLSv1.2" },
    auth: { user: settings.user, pass: settings.password },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: IMAP_TIMEOUT_MS,
    greetingTimeout: IMAP_TIMEOUT_MS,
    socketTimeout: IMAP_TIMEOUT_MS * 3,
  });
  await client.connect();
  return client;
}

export function isImapAuthError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "authenticationFailed" in error && error.authenticationFailed === true;
}

/** Vérifie l'accès (connexion TLS et authentification) sans rien lire. */
export async function verifyImap(settings: ImapSettings): Promise<{ ok: true } | { ok: false; error: string }> {
  let client: ImapFlow | null = null;
  try {
    client = await openImap(settings);
    if (!client) return { ok: false, error: IMAP_UNREACHABLE };
    await client.logout();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: isImapAuthError(error)
        ? "Le serveur IMAP a refusé l'identifiant ou le mot de passe."
        : "Connexion au serveur IMAP impossible : vérifiez le serveur de réception.",
    };
  } finally {
    client?.close();
  }
}
