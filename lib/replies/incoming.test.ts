import MailComposer from "nodemailer/lib/mail-composer";
import { describe, expect, it } from "vitest";
import { newMessageId, normalizeMessageId, parseMessageIdList } from "@/lib/mail/message-id";
import { parseIncomingMessage } from "./incoming";

type MessageOptions = ConstructorParameters<typeof MailComposer>[0];

const compose = (options: MessageOptions) =>
  new MailComposer({ from: "Yann Caradec <Compta@Caradec.example>", to: "contact@atelier.example", ...options }).compile().build();

describe("identifiants de message", () => {
  it("crée un identifiant sous le domaine de l'expéditeur", () => {
    expect(newMessageId("factures@Atelier.example")).toMatch(/^<[0-9a-f-]{36}@atelier\.example>$/);
  });

  it("normalise et lit une liste d'identifiants", () => {
    expect(normalizeMessageId(" <ABC@Mail.example> ")).toBe("abc@mail.example");
    expect(parseMessageIdList("<a@x.example> <b@y.example>\r\n <c@z.example>")).toEqual(["a@x.example", "b@y.example", "c@z.example"]);
    expect(parseMessageIdList(["<a@x.example>", "b@y.example"])).toEqual(["a@x.example", "b@y.example"]);
    expect(parseMessageIdList(undefined)).toEqual([]);
  });
});

describe("parseIncomingMessage", () => {
  it("lit une réponse : citations, expéditeur, identifiants cités du plus récent au plus ancien", async () => {
    const raw = await compose({
      subject: "RE: Facture F-2026-0412",
      messageId: "<reponse@caradec.example>",
      inReplyTo: "<relance-2@atelier.example>",
      references: ["<relance-1@atelier.example>", "<relance-2@atelier.example>"],
      text: "Bonjour,\n\nJe vous règle vendredi.\n\nLe lun. 21 sept. 2026 à 09:30, Atelier <contact@atelier.example> a écrit :\n> Notre facture reste impayée.",
    });

    const message = await parseIncomingMessage(raw);

    expect(message).toMatchObject({
      messageId: "reponse@caradec.example",
      referencedIds: ["relance-2@atelier.example", "relance-1@atelier.example"],
      fromAddress: "compta@caradec.example",
      subject: "RE: Facture F-2026-0412",
      text: "Bonjour,\n\nJe vous règle vendredi.",
      automated: null,
    });
  });

  it("lit une réponse sans partie texte à partir du HTML, sans la citation", async () => {
    const raw = await compose({
      subject: "RE: Facture",
      html: "<div>Réglé ce matin par virement.</div><blockquote>Notre facture reste impayée.</blockquote>",
    });

    expect((await parseIncomingMessage(raw)).text).toBe("Réglé ce matin par virement.");
  });

  it("reconnaît un message d'absence à ses en-têtes", async () => {
    const raw = await compose({ subject: "RE: Facture", text: "Je suis absent.", headers: { "Auto-Submitted": "auto-replied" } });

    expect((await parseIncomingMessage(raw)).automated).toBe("auto_reply");
  });

  it("reconnaît un avis de non-remise", async () => {
    const raw = await compose({
      from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
      subject: "Delivery Status Notification (Failure)",
      text: "Address not found.",
    });

    expect((await parseIncomingMessage(raw)).automated).toBe("bounce");
  });
});
