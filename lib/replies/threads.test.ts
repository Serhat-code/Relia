import { describe, expect, it } from "vitest";
import { indexByMessageId, indexByThread, matchByReferences, matchInRawText, MAX_LOOKBACK_DAYS, readSince, type SentReminderRef } from "./threads";

const reminder = (id: string, overrides: Partial<SentReminderRef> = {}): SentReminderRef => ({
  reminderId: id,
  invoiceId: `facture-${id}`,
  threadId: `fil-${id}`,
  providerMessageId: `<${id}@atelier.example>`,
  sentAt: "2026-09-10T07:30:00Z",
  ...overrides,
});

describe("indexByThread", () => {
  it("rattache un fil à sa relance la plus récente", () => {
    const index = indexByThread([
      reminder("1", { threadId: "fil", sentAt: "2026-09-01T07:30:00Z" }),
      reminder("2", { threadId: "fil", sentAt: "2026-09-10T07:30:00Z" }),
      reminder("3", { threadId: null }),
    ]);

    expect(index.get("fil")?.reminderId).toBe("2");
    expect(index.size).toBe(1);
  });
});

describe("matchByReferences", () => {
  const index = indexByMessageId([reminder("1"), reminder("2")]);

  it("suit In-Reply-To puis les références, sans tenir compte de la casse ni des chevrons", () => {
    expect(matchByReferences(["inconnu@x.example", "<2@ATELIER.example>"], index)?.reminderId).toBe("2");
    expect(matchByReferences(["inconnu@x.example"], index)).toBeNull();
  });

  it("retrouve la relance citée dans le texte brut d'un avis de non-remise", () => {
    const raw = "Delivery failed.\r\n\r\nMessage-ID: <1@atelier.example>\r\nSubject: Facture";

    expect(matchInRawText(raw, index)?.reminderId).toBe("1");
    expect(matchInRawText("Rien à voir <autre@ailleurs.example>", index)).toBeNull();
  });
});

describe("readSince", () => {
  const now = new Date("2026-09-21T10:00:00Z");

  it("reprend une heure avant la dernière lecture", () => {
    expect(readSince("2026-09-21T09:30:00Z", "2026-09-01T07:30:00Z", now).toISOString()).toBe("2026-09-21T08:30:00.000Z");
  });

  it("sans lecture précédente, part de la plus ancienne relance suivie", () => {
    expect(readSince(null, "2026-09-15T07:30:00Z", now).toISOString()).toBe("2026-09-15T07:30:00.000Z");
  });

  it(`ne remonte jamais au-delà de ${MAX_LOOKBACK_DAYS} jours`, () => {
    expect(readSince(null, "2026-07-01T07:30:00Z", now).toISOString()).toBe("2026-09-07T10:00:00.000Z");
  });
});
