import { describe, expect, it } from "vitest";
import { htmlToText, replyExcerpt, stripQuotedReply } from "./quote";

describe("stripQuotedReply", () => {
  it("retire la relance citée par Gmail (en français)", () => {
    const text = [
      "Bonjour,",
      "",
      "Je vous règle vendredi.",
      "",
      "Le lun. 21 sept. 2026 à 09:30, Atelier Démo <contact@atelier.example> a écrit :",
      "> Bonjour, notre facture F-2026-0412 reste impayée.",
    ].join("\n");

    expect(stripQuotedReply(text)).toBe("Bonjour,\n\nJe vous règle vendredi.");
  });

  it("reconnaît un en-tête de citation coupé sur deux lignes", () => {
    const text = "Réglé ce matin.\n\nLe lun. 21 sept. 2026 à 09:30, Atelier Démo <\ncontact@atelier.example> a écrit :\n> Relance";

    expect(stripQuotedReply(text)).toBe("Réglé ce matin.");
  });

  it("retire le bloc d'en-têtes d'Outlook", () => {
    const text = "Bien reçu, je regarde.\r\n\r\nDe : Atelier Démo <contact@atelier.example>\r\nEnvoyé : lundi 21 septembre 2026 09:30\r\nÀ : compta@client.example";

    expect(stripQuotedReply(text)).toBe("Bien reçu, je regarde.");
  });

  it("retire le séparateur souligné d'Outlook et la citation en anglais", () => {
    expect(stripQuotedReply("Paid today.\n________________________________\nFrom: Atelier")).toBe("Paid today.");
    expect(stripQuotedReply("Will pay Friday.\n\nOn Mon, Sep 21, 2026 at 9:30 AM Atelier <a@b.example> wrote:\n> Hello")).toBe(
      "Will pay Friday.",
    );
  });

  it("retire la signature et les lignes citées isolées", () => {
    const text = "> ancienne ligne\nJe paie le 30/09.\n-- \nJean Martin\nComptabilité";

    expect(stripQuotedReply(text)).toBe("Je paie le 30/09.");
  });

  it("borne la longueur conservée", () => {
    expect(stripQuotedReply("a".repeat(10_000))).toHaveLength(4000);
  });
});

describe("htmlToText", () => {
  it("garde le texte, retire la citation et les styles", () => {
    const html =
      "<style>p{color:red}</style><p>Bonjour,</p><p>Je r&egrave;gle le 30/09.</p><blockquote><p>Relance</p></blockquote>";

    expect(htmlToText(html)).toBe("Bonjour,\nJe règle le 30/09.");
  });

  it("décode les entités numériques et ignore celles qui sont invalides", () => {
    expect(htmlToText("500&#8364; &#x20AC; &#0; &#99999999; &inconnue;")).toBe("500€ € &inconnue;");
  });

  it("transforme les sauts de ligne HTML", () => {
    expect(htmlToText("Ligne 1<br>Ligne 2<br/>Ligne 3")).toBe("Ligne 1\nLigne 2\nLigne 3");
  });
});

describe("replyExcerpt", () => {
  it("aplatit les espaces", () => {
    expect(replyExcerpt("Bonjour,\n\n  je règle   vendredi.")).toBe("Bonjour, je règle vendredi.");
  });

  it("coupe au-delà de 500 caractères", () => {
    const excerpt = replyExcerpt("mot ".repeat(300));

    expect(excerpt).toHaveLength(500);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});
