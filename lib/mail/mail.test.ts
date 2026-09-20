import { describe, expect, it } from "vitest";
import { buildMimeMessage } from "./message";
import { buildAuthorizationUrl, canSendWith, emailFromIdToken, parseTokenResponse } from "./oauth";
import { codeChallenge, createCodeVerifier } from "./pkce";
import { isAllowedSmtpPort, isPublicAddress } from "./smtp-guard";

describe("PKCE (RFC 7636)", () => {
  it("calcule le défi S256 du vecteur de test de la RFC", async () => {
    expect(await codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("produit un vérificateur aléatoire de 43 caractères base64url", () => {
    const verifier = createCodeVerifier();

    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createCodeVerifier()).not.toBe(verifier);
  });
});

describe("buildAuthorizationUrl", () => {
  const common = {
    clientId: "client-123",
    redirectUri: "https://relia.example/app/boite-mail/retour/google",
    state: "etat-aleatoire",
    codeChallenge: "defi",
  };

  it("Google : envoi et lecture Gmail, jeton de rafraîchissement, PKCE", () => {
    const url = new URL(buildAuthorizationUrl("google", common));

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "client-123",
      redirect_uri: common.redirectUri,
      response_type: "code",
      scope:
        "openid email https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
      state: "etat-aleatoire",
      code_challenge: "defi",
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "consent",
    });
  });

  it("Microsoft : comptes personnels et professionnels, accès hors connexion", () => {
    const url = new URL(buildAuthorizationUrl("microsoft", { ...common, redirectUri: "https://relia.example/r" }));

    expect(url.origin + url.pathname).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    expect(url.searchParams.get("scope")).toBe(
      "openid email offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read",
    );
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });
});

describe("réponses des fournisseurs", () => {
  it("lit une réponse de jeton et calcule l'expiration", () => {
    const now = Date.parse("2026-09-19T10:00:00Z");

    expect(
      parseTokenResponse({ access_token: "a", refresh_token: "r", expires_in: 3599, id_token: "x.y.z", scope: "s" }, now),
    ).toEqual({
      accessToken: "a",
      refreshToken: "r",
      expiresAt: "2026-09-19T10:59:59.000Z",
      idToken: "x.y.z",
      grantedScopes: ["s"],
    });
  });

  it("vérifie que la permission d'envoi a bien été accordée", () => {
    const tokens = (scope: string) => parseTokenResponse({ access_token: "a", expires_in: 60, scope }, 0);

    expect(canSendWith("google", tokens("openid email https://www.googleapis.com/auth/gmail.send")!)).toBe(true);
    expect(canSendWith("google", tokens("openid email https://www.googleapis.com/auth/gmail.readonly")!)).toBe(false);
    expect(canSendWith("microsoft", tokens("Mail.Read Mail.Send User.Read")!)).toBe(true);
  });

  it("refuse une réponse incomplète", () => {
    expect(parseTokenResponse({ error: "invalid_grant" }, 0)).toBeNull();
  });

  it("lit l'adresse vérifiée dans un jeton d'identité émis par Google pour Relia et non expiré", () => {
    const now = Date.parse("2026-09-19T10:00:00Z");
    const token = (claims: Record<string, unknown>) =>
      `entete.${Buffer.from(
        JSON.stringify({
          iss: "https://accounts.google.com",
          aud: "client-123",
          exp: now / 1000 + 600,
          email: "compta@atelier.example",
          email_verified: true,
          ...claims,
        }),
      ).toString("base64url")}.signature`;

    expect(emailFromIdToken(token({}), "client-123", now)).toBe("compta@atelier.example");
    expect(emailFromIdToken(token({ aud: "autre-application" }), "client-123", now)).toBeNull();
    expect(emailFromIdToken(token({ iss: "https://faux.example" }), "client-123", now)).toBeNull();
    expect(emailFromIdToken(token({ exp: now / 1000 - 1 }), "client-123", now)).toBeNull();
    expect(emailFromIdToken(token({ email_verified: false }), "client-123", now)).toBeNull();
    expect(emailFromIdToken("illisible", "client-123", now)).toBeNull();
  });
});

describe("garde SMTP (pas de connexion vers le réseau interne)", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.10", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1",
    // Revue du palier 9 : formes IPv6 qui encapsulent une adresse interne, plages réservées.
    "::127.0.0.1", "::169.254.169.254", "64:ff9b::7f00:1", "64:ff9b::a9fe:a9fe", "0:0:0:0:0:0:0:1",
    "2002:7f00:1::1", "2001::1", "192.0.2.1", "198.51.100.2", "203.0.113.5", "100.64.1.1", "localhost", "999.1.1.1"])(
    "refuse l'adresse interne %s",
    (ip) => {
      expect(isPublicAddress(ip)).toBe(false);
    },
  );

  it.each(["91.121.10.10", "2001:4860:4860::8888"])("accepte l'adresse publique %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it("n'autorise que les ports de messagerie", () => {
    expect([25, 465, 587, 2525].every(isAllowedSmtpPort)).toBe(true);
    expect(isAllowedSmtpPort(22)).toBe(false);
    expect(isAllowedSmtpPort(5432)).toBe(false);
  });
});

describe("buildMimeMessage", () => {
  it("compose un message texte et HTML au nom du client, objet encodé en UTF-8", async () => {
    const raw = (
      await buildMimeMessage({
        from: { name: "Atelier Démo", address: "compta@atelier.example" },
        to: "client@exemple.fr",
        subject: "Facture F-1 : règlement en attente",
        text: "Bonjour,\nMerci.",
        html: "<p>Bonjour,<br>Merci.</p>",
        messageId: "<relia-1@atelier.example>",
      })
    ).toString("utf8");

    expect(raw).toMatch(/^From: =\?UTF-8\?Q\?Atelier_D=C3=A9mo\?= <compta@atelier\.example>/m);
    expect(raw).toMatch(/^To: client@exemple\.fr/m);
    expect(raw).toMatch(/^Subject: =\?UTF-8\?/m);
    expect(raw).toMatch(/^Message-ID: <relia-1@atelier\.example>/m);
    expect(raw).toContain("multipart/alternative");
    expect(raw).toContain("text/html");
  });
});
