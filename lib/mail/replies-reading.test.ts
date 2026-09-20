import { describe, expect, it } from "vitest";
import { readsReplies } from "./replies-reading";

describe("readsReplies", () => {
  it("lit les réponses par l'API du fournisseur, avec ou sans serveur IMAP", () => {
    expect(readsReplies({ provider: "gmail", imapHost: null })).toBe(true);
    expect(readsReplies({ provider: "outlook", imapHost: null })).toBe(true);
  });

  it("n'entend rien en SMTP tant que le serveur IMAP n'est pas renseigné", () => {
    expect(readsReplies({ provider: "smtp", imapHost: null })).toBe(false);
    expect(readsReplies({ provider: "smtp", imapHost: "imap.gmx.com" })).toBe(true);
  });
});
