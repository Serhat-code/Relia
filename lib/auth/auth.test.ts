import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";
import { hasRecentRecovery } from "./recovery";
import { authErrorMessage } from "./errors";
import { safeNextPath } from "./redirect";
import { firstFieldErrors, resetPasswordSchema, signInSchema, signUpSchema } from "./schemas";

const validSignUp = {
  fullName: "Nina Fondatrice",
  organizationName: "Atelier Nouveau",
  siren: "123 456 782",
  email: "  Nina@Atelier.FR ",
  password: "relances2026",
  dpaAccepted: "on",
};

describe("signUpSchema", () => {
  it("normalise l'e-mail et le SIREN", () => {
    const parsed = signUpSchema.parse(validSignUp);

    expect(parsed.email).toBe("nina@atelier.fr");
    expect(parsed.siren).toBe("123456782");
  });

  it("le SIREN est facultatif", () => {
    expect(signUpSchema.parse({ ...validSignUp, siren: "" }).siren).toBe("");
  });

  it("refuse un SIREN dont la clé de contrôle est fausse", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, siren: "123456789" });

    expect(result.success).toBe(false);
    expect(firstFieldErrors(result.error).siren).toMatch(/SIREN/);
  });

  it("exige l'acceptation du DPA", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, dpaAccepted: undefined });

    expect(firstFieldErrors(result.error).dpaAccepted).toMatch(/accord de sous-traitance/);
  });

  it.each([
    ["court1", /10 caractères/],
    ["sanschiffres", /chiffre/],
    ["1234567890", /lettre/],
  ])("refuse le mot de passe « %s »", (password, message) => {
    const result = signUpSchema.safeParse({ ...validSignUp, password });

    expect(firstFieldErrors(result.error).password).toMatch(message);
  });
});

describe("signInSchema et resetPasswordSchema", () => {
  it("exige un mot de passe à la connexion", () => {
    const result = signInSchema.safeParse({ email: "a@b.fr", password: "" });

    expect(firstFieldErrors(result.error).password).toBeDefined();
  });

  it("vérifie que la confirmation correspond", () => {
    const result = resetPasswordSchema.safeParse({ password: "relances2026", confirmation: "relances2027" });

    expect(firstFieldErrors(result.error).confirmation).toMatch(/ne correspondent pas/);
  });
});

describe("authErrorMessage", () => {
  it.each([
    ["invalid_credentials", /incorrect/],
    ["email_not_confirmed", /Confirmez/],
    ["over_email_send_rate_limit", /Trop de tentatives/],
    ["weak_password", /trop faible/],
    ["code_inconnu", /Une erreur est survenue/],
  ])("%s → message français", (code, message) => {
    expect(authErrorMessage(code)).toMatch(message);
  });
});

describe("safeNextPath", () => {
  it("garde un chemin interne", () => {
    expect(safeNextPath("/app/factures?statut=late")).toBe("/app/factures?statut=late");
  });

  it.each(["https://pirate.example", "//pirate.example", "/\\pirate.example", "app", "", null, undefined, 42])(
    "refuse %s (redirection ouverte) et renvoie vers /app",
    (value) => {
      expect(safeNextPath(value)).toBe("/app");
    },
  );
});

describe("hasRecentRecovery", () => {
  const now = 1_800_000_000;

  it("accepte une session ouverte par un lien de récupération récent", () => {
    expect(hasRecentRecovery([{ method: "recovery", timestamp: now - 60 }], now)).toBe(true);
  });

  it("refuse une session ordinaire (mot de passe) : une session volée ne suffit pas", () => {
    expect(hasRecentRecovery([{ method: "password", timestamp: now - 60 }], now)).toBe(false);
  });

  it("refuse un lien de récupération utilisé il y a plus de 15 minutes", () => {
    expect(hasRecentRecovery([{ method: "recovery", timestamp: now - 16 * 60 }], now)).toBe(false);
  });

  it("refuse un contenu inattendu", () => {
    expect(hasRecentRecovery(undefined, now)).toBe(false);
    expect(hasRecentRecovery("recovery", now)).toBe(false);
  });
});

describe("clientIp", () => {
  it("préfère x-vercel-forwarded-for, posé par Vercel et impossible à forger par le client", () => {
    const headers = new Headers({ "x-vercel-forwarded-for": "198.51.100.4", "x-forwarded-for": "203.0.113.9" });

    expect(clientIp(headers)).toBe("198.51.100.4");
  });

  it("puis x-real-ip, avant x-forwarded-for", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.5", "x-forwarded-for": "203.0.113.9" });

    expect(clientIp(headers)).toBe("198.51.100.5");
  });

  it("à défaut, prend la première adresse de x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("accepte l'IPv6", () => {
    expect(clientIp(new Headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("ignore une valeur qui n'est pas une adresse IP", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "<script>" }))).toBe("0.0.0.0");
  });
});
