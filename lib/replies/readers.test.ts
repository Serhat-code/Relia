import { afterEach, describe, expect, it, vi } from "vitest";
import type { SentReminderRef } from "./threads";

vi.mock("server-only", () => ({}));

const { gmailReader, imapMessageKey, MAX_MESSAGE_BYTES, outlookReader, ReaderError } = await import("./readers");

const REMINDERS: SentReminderRef[] = [
  { reminderId: "r1", invoiceId: "f1", threadId: "fil-1", providerMessageId: "m-relance", sentAt: "2026-09-18T07:30:00Z" },
];
const CONTEXT = { since: new Date("2026-09-18T07:00:00Z"), mailboxAddress: "contact@atelier.example", reminders: REMINDERS };

type Route = (url: URL) => { status?: number; json?: unknown; body?: string; headers?: Record<string, string> };

function stubFetch(route: Route) {
  const calls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = new URL(input);
      calls.push(url);
      const { status = 200, json, body, headers } = route(url);
      return new Response(body ?? JSON.stringify(json ?? {}), { status, headers });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("gmailReader", () => {
  it("ne retient que les messages des fils de relance, reçus depuis la dernière lecture et pas envoyés par le client", async () => {
    const calls = stubFetch((url) =>
      url.searchParams.get("pageToken")
        ? { json: { messages: [{ id: "m3", threadId: "fil-1" }] } }
        : { json: { messages: [{ id: "m1", threadId: "fil-1" }, { id: "m2", threadId: "fil-perso" }], nextPageToken: "p2" } },
    );

    const candidates = await gmailReader("jeton", CONTEXT).listCandidates();

    expect(candidates.map((candidate) => candidate.providerMessageId)).toEqual(["m1", "m3"]);
    expect(calls[0]?.searchParams.get("q")).toBe(`after:${Date.parse("2026-09-18T07:00:00Z") / 1000} -from:me`);
  });

  const candidate = { providerMessageId: "m1", reminder: REMINDERS[0] ?? null, receivedAt: null, fetchKey: "m1" };

  it("vérifie la taille, puis télécharge le message brut avec sa date de réception", async () => {
    const calls = stubFetch((url) =>
      url.searchParams.get("format") === "minimal"
        ? { json: { sizeEstimate: 2048, internalDate: "1790000000000" } }
        : { json: { raw: Buffer.from("Subject: RE\r\n\r\nOK").toString("base64url") } },
    );

    const fetched = await gmailReader("jeton", CONTEXT).fetchRaw(candidate);

    expect(fetched?.raw?.toString()).toBe("Subject: RE\r\n\r\nOK");
    expect(fetched?.receivedAt?.getTime()).toBe(1_790_000_000_000);
    expect(calls.map((url) => url.searchParams.get("format"))).toEqual(["minimal", "raw"]);
  });

  it("ne télécharge pas un message trop volumineux", async () => {
    const calls = stubFetch(() => ({ json: { sizeEstimate: MAX_MESSAGE_BYTES + 1, internalDate: "1790000000000" } }));

    const fetched = await gmailReader("jeton", CONTEXT).fetchRaw(candidate);

    expect(fetched).toEqual({ raw: null, receivedAt: new Date(1_790_000_000_000) });
    expect(calls).toHaveLength(1);
  });

  it("signale un refus d'accès (lecture non autorisée)", async () => {
    stubFetch(() => ({ status: 403 }));

    const failure = await gmailReader("jeton", CONTEXT).listCandidates().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ReaderError);
    expect(failure).toMatchObject({ isAuthError: true, message: expect.stringMatching(/autorisant la lecture/) });
  });
});

describe("outlookReader", () => {
  it("filtre par conversation, écarte les messages du client et ne suit une page suivante que chez Microsoft", async () => {
    const calls = stubFetch(() => ({
      json: {
        value: [
          { id: "o1", conversationId: "fil-1", receivedDateTime: "2026-09-19T08:00:00Z", from: { emailAddress: { address: "compta@caradec.example" } } },
          { id: "o2", conversationId: "fil-1", receivedDateTime: "2026-09-19T09:00:00Z", from: { emailAddress: { address: "Contact@Atelier.example" } } },
          { id: "o3", conversationId: "autre", receivedDateTime: "2026-09-19T10:00:00Z", from: null },
        ],
        "@odata.nextLink": "https://attaquant.example/v1.0/me/messages?page=2",
      },
    }));

    const candidates = await outlookReader("jeton", CONTEXT).listCandidates();

    expect(candidates).toEqual([
      { providerMessageId: "o1", reminder: REMINDERS[0], receivedAt: new Date("2026-09-19T08:00:00Z"), fetchKey: "o1" },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.searchParams.get("$filter")).toBe("receivedDateTime ge 2026-09-18T07:00:00.000Z");
  });

  it("télécharge le message au format MIME", async () => {
    const calls = stubFetch(() => ({ body: "Subject: RE\r\n\r\nOK" }));

    const fetched = await outlookReader("jeton", CONTEXT).fetchRaw({ providerMessageId: "o1", reminder: null, receivedAt: null, fetchKey: "o/1" });

    expect(fetched?.raw?.toString()).toBe("Subject: RE\r\n\r\nOK");
    expect(calls[0]?.pathname).toBe("/v1.0/me/messages/o%2F1/$value");
  });

  it("interrompt la lecture d'un message trop volumineux, annoncé ou non", async () => {
    const reader = outlookReader("jeton", CONTEXT);
    const oversized = { providerMessageId: "o1", reminder: null, receivedAt: null, fetchKey: "o1" };

    stubFetch(() => ({ body: "x".repeat(MAX_MESSAGE_BYTES + 1) }));
    expect((await reader.fetchRaw(oversized))?.raw).toBeNull();

    stubFetch(() => ({ body: "court", headers: { "content-length": String(MAX_MESSAGE_BYTES * 20) } }));
    expect((await reader.fetchRaw(oversized))?.raw).toBeNull();
  });
});

describe("imapMessageKey", () => {
  it("remplace le Message-ID, choisi par l'expéditeur, par une empreinte stable et sans caractère spécial", () => {
    const trapped = imapMessageKey('<a",b)(c@mail.example>', "7", 42);

    expect(trapped).toMatch(/^imap:[0-9a-f]{64}$/);
    expect(imapMessageKey("<A\",B)(C@Mail.example>", "8", 43)).toBe(trapped);
    expect(imapMessageKey(null, "7", 42)).toBe("imap:7:42");
  });
});
