/**
 * Lecture des réponses des clients (§5.6). Gmail et Outlook la font par leur API ; le repli SMTP
 * exige un serveur IMAP, facultatif à la connexion. Sans lui, les relances partent mais aucune
 * réponse n'est entendue : ni promesse détectée, ni mise en pause. La règle vit ici pour que la
 * carte de la boîte d'envoi et le tableau de bord ne puissent pas diverger.
 */
export type ReplyReadingMailbox = { provider: "gmail" | "outlook" | "smtp"; imapHost: string | null };

export const readsReplies = (mailbox: ReplyReadingMailbox) =>
  mailbox.provider !== "smtp" || mailbox.imapHost !== null;
