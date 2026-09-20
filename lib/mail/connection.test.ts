import { describe, expect, it } from "vitest";
import { parseOAuthStateCookie, serializeOAuthStateCookie } from "./oauth-state";
import { parseSmtpForm, SMTP_PRESETS } from "./smtp-form";

const SMTP = {
  host: " SSL0.OVH.NET ",
  port: "465",
  user: "factures@atelier.example",
  password: "  secret avec espaces ",
  emailAddress: "Factures@Atelier.example",
  displayName: "Atelier Démo",
};

describe("parseSmtpForm", () => {
  it("normalise le serveur et l'adresse, garde le mot de passe tel quel", () => {
    expect(parseSmtpForm(SMTP)).toEqual({
      ok: true,
      settings: {
        host: "ssl0.ovh.net",
        port: 465,
        user: "factures@atelier.example",
        password: "  secret avec espaces ",
        emailAddress: "factures@atelier.example",
        displayName: "Atelier Démo",
        imapHost: null,
        imapPort: null,
      },
    });
  });

  it("garde le serveur IMAP, facultatif, pour lire les réponses (port 993 par défaut)", () => {
    const parsed = parseSmtpForm({ ...SMTP, imapHost: " SSL0.OVH.NET ", imapPort: "" });

    expect(parsed).toMatchObject({ ok: true, settings: { imapHost: "ssl0.ovh.net", imapPort: 993 } });
  });

  it("refuse un serveur IMAP mal formé ou un port IMAP non chiffré", () => {
    expect(parseSmtpForm({ ...SMTP, imapHost: "localhost", imapPort: "993" })).toEqual({
      ok: false,
      fieldErrors: { imapHost: "Nom de serveur invalide (exemple : ssl0.ovh.net)." },
    });
    expect(parseSmtpForm({ ...SMTP, imapHost: "imap.ionos.fr", imapPort: "143" })).toEqual({
      ok: false,
      fieldErrors: { imapPort: "Port IMAP attendu : 993 (connexion chiffrée)." },
    });
  });

  it("refuse un port hors messagerie, un serveur mal formé et une adresse invalide", () => {
    expect(parseSmtpForm({ ...SMTP, host: "localhost", port: "22", emailAddress: "x" })).toEqual({
      ok: false,
      fieldErrors: {
        host: "Nom de serveur invalide (exemple : ssl0.ovh.net).",
        port: "Port de messagerie attendu : 465, 587, 25 ou 2525.",
        emailAddress: "Adresse e-mail invalide.",
      },
    });
  });

  it("les préréglages utilisent des ports autorisés et un serveur IMAP valide", () => {
    expect(SMTP_PRESETS.every((preset) => [465, 587].includes(preset.port))).toBe(true);
    for (const preset of SMTP_PRESETS) {
      expect(parseSmtpForm({ ...SMTP, host: preset.host, imapHost: preset.imapHost, imapPort: "993" }).ok).toBe(true);
    }
  });
});

describe("cookie d'état OAuth", () => {
  const state = { state: "abc", verifier: "def", provider: "google" as const, userId: "0b4e7f1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b" };

  it("se relit tel qu'il a été écrit", () => {
    expect(parseOAuthStateCookie(serializeOAuthStateCookie(state))).toEqual(state);
  });

  it("refuse un contenu altéré ou absent", () => {
    expect(parseOAuthStateCookie(undefined)).toBeNull();
    expect(parseOAuthStateCookie("pas-du-json")).toBeNull();
    expect(parseOAuthStateCookie(JSON.stringify({ ...state, provider: "yahoo" }))).toBeNull();
  });
});
