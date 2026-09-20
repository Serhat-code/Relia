import MailComposer from "nodemailer/lib/mail-composer";

/**
 * Message de relance au format MIME (RFC 5322), envoyé au nom du client : l'expéditeur est
 * toujours sa propre adresse (§2.1). Texte et HTML, objet encodé en UTF-8.
 */
export type OutgoingMessage = {
  from: { name: string; address: string };
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Identifiant du message, pour rattacher les réponses (palier 11). */
  messageId?: string;
  inReplyTo?: string;
};

export function buildMimeMessage(message: OutgoingMessage): Promise<Buffer> {
  const composer = new MailComposer({
    from: message.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    messageId: message.messageId,
    inReplyTo: message.inReplyTo,
    references: message.inReplyTo,
    textEncoding: "quoted-printable",
  });
  return composer.compile().build();
}
