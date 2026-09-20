import { describe, expect, it } from "vitest";
import { detectAutomatedMessage, headerMap } from "./automated";

const headers = (entries: Record<string, string> = {}) => headerMap(Object.entries(entries));

describe("headerMap", () => {
  it("indexe les en-têtes en minuscules et garde la première valeur", () => {
    const map = headerMap([
      ["Auto-Submitted", "auto-replied"],
      ["auto-submitted", "no"],
    ]);

    expect(map.get("auto-submitted")).toBe("auto-replied");
  });
});

describe("detectAutomatedMessage", () => {
  it("laisse passer une vraie réponse", () => {
    expect(detectAutomatedMessage(headers(), "RE: Facture F-2026-0412", "compta@client.example")).toBeNull();
  });

  it.each([
    ["Auto-Submitted (RFC 3834)", headers({ "Auto-Submitted": "auto-replied" }), "RE: Facture"],
    ["X-Autoreply", headers({ "X-Autoreply": "yes" }), "RE: Facture"],
    ["Precedence: auto_reply", headers({ Precedence: "auto_reply" }), "RE: Facture"],
    ["objet « Réponse automatique »", headers(), "Réponse automatique : Facture F-2026-0412"],
    ["objet « Absent »", headers(), "Absent jusqu'au 28/09"],
    ["objet « Out of office »", headers(), "Out of Office: Facture F-2026-0412"],
    ["objet « Automatic reply »", headers(), "Automatic reply: Facture"],
  ])("reconnaît un message d'absence : %s", (_case, messageHeaders, subject) => {
    expect(detectAutomatedMessage(messageHeaders, subject, "compta@client.example")).toBe("auto_reply");
  });

  it("n'écarte pas un message marqué « Auto-Submitted: no »", () => {
    expect(detectAutomatedMessage(headers({ "Auto-Submitted": "no" }), "RE: Facture", "compta@client.example")).toBeNull();
  });

  it.each([
    ["expéditeur mailer-daemon", headers(), "Facture F-2026-0412", "MAILER-DAEMON@mail.example"],
    ["rapport de remise", headers({ "Content-Type": 'multipart/report; report-type="delivery-status"' }), "Facture", "a@b.example"],
    ["objet « Undeliverable »", headers(), "Undeliverable: Facture F-2026-0412", "postmaster@client.example"],
    ["objet « Non remis »", headers(), "Non remis : Facture F-2026-0412", "exchange@client.example"],
    ["objet « Échec de la remise »", headers(), "Échec de la remise du message", "system@client.example"],
  ])("reconnaît un avis de non-remise : %s", (_case, messageHeaders, subject, from) => {
    expect(detectAutomatedMessage(messageHeaders, subject, from)).toBe("bounce");
  });
});
