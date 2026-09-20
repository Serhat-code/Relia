/** Ports de messagerie acceptés pour un serveur SMTP (SMTP, SMTPS, soumission, alternative courante). */
export const ALLOWED_SMTP_PORTS: ReadonlySet<number> = new Set([25, 465, 587, 2525]);

export const isAllowedSmtpPort = (port: number) => ALLOWED_SMTP_PORTS.has(port);

/** Lecture des réponses en IMAP : TLS implicite seulement (IMAPS), jamais en clair. */
export const IMAP_PORT = 993;

export const isAllowedImapPort = (port: number) => port === IMAP_PORT;
