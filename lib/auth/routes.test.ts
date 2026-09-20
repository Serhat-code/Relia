import { describe, expect, it } from "vitest";
import { authRedirect, needsSession } from "./routes";

describe("authRedirect", () => {
  it("renvoie un visiteur non connecté vers la connexion, en gardant sa destination", () => {
    expect(authRedirect("/app/factures", "?statut=late", false)).toEqual({
      pathname: "/connexion",
      search: "?next=%2Fapp%2Ffactures%3Fstatut%3Dlate",
    });
  });

  it("laisse passer un membre connecté dans l'application", () => {
    expect(authRedirect("/app", "", true)).toBeNull();
  });

  it.each(["/connexion", "/inscription", "/mot-de-passe-oublie"])(
    "renvoie un membre déjà connecté de %s vers l'application",
    (pathname) => {
      expect(authRedirect(pathname, "", true)).toEqual({ pathname: "/app", search: "" });
    },
  );

  it("laisse un visiteur accéder aux pages de connexion et d'inscription", () => {
    expect(authRedirect("/inscription", "", false)).toBeNull();
  });

  it("la réinitialisation du mot de passe exige la session ouverte par le lien reçu", () => {
    expect(authRedirect("/reinitialiser", "", false)).toEqual({ pathname: "/mot-de-passe-oublie", search: "" });
    expect(authRedirect("/reinitialiser", "", true)).toBeNull();
  });

  it("ne confond pas /application avec /app", () => {
    expect(authRedirect("/application", "", false)).toBeNull();
  });
});

describe("needsSession", () => {
  it("l'espace client et les pages d'authentification lisent la session, pas les pages publiques", () => {
    expect(["/app", "/app/factures/42", "/connexion", "/inscription/finaliser", "/reinitialiser"].every(needsSession)).toBe(true);
    expect(["/", "/tarifs", "/cgu", "/application", "/design/app"].some(needsSession)).toBe(false);
  });
});
