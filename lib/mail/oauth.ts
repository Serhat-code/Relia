import { z } from "zod";

/**
 * Connexion OAuth de la boîte e-mail du client (Gmail, Outlook) : les relances partent de son
 * adresse (§2.1). Relia n'obtient que l'envoi et la lecture des messages, jamais son mot de passe.
 */

export type OAuthProvider = "google" | "microsoft";

type ProviderConfig = { authorizeUrl: string; tokenUrl: string; scopes: readonly string[]; extraParams: Record<string, string> };

export const OAUTH_PROVIDERS: Readonly<Record<OAuthProvider, ProviderConfig>> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    // gmail.readonly servira à lire les réponses des clients (palier 11).
    scopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
    // offline + consent : Google ne délivre le jeton de rafraîchissement qu'ainsi.
    extraParams: { access_type: "offline", prompt: "consent" },
  },
  microsoft: {
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: [
      "openid",
      "email",
      "offline_access",
      "https://graph.microsoft.com/User.Read",
      "https://graph.microsoft.com/Mail.Send",
      "https://graph.microsoft.com/Mail.Read",
    ],
    extraParams: { prompt: "select_account" },
  },
};

/** Permission indispensable : envoyer depuis la boîte du client. */
const SEND_SCOPES: Readonly<Record<OAuthProvider, readonly string[]>> = {
  google: ["https://www.googleapis.com/auth/gmail.send"],
  microsoft: ["Mail.Send", "https://graph.microsoft.com/Mail.Send"],
};

/** Vrai si l'envoi est autorisé (réponse sans liste de permissions : on s'en remet au premier envoi). */
export function canSendWith(provider: OAuthProvider, tokens: OAuthTokens): boolean {
  if (!tokens.grantedScopes) return true;
  return tokens.grantedScopes.some((scope) => SEND_SCOPES[provider].includes(scope));
}

type AuthorizationRequest = { clientId: string; redirectUri: string; state: string; codeChallenge: string };

export function buildAuthorizationUrl(provider: OAuthProvider, request: AuthorizationRequest): string {
  const config = OAUTH_PROVIDERS[provider];
  const url = new URL(config.authorizeUrl);
  const params: Record<string, string> = {
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state: request.state,
    code_challenge: request.codeChallenge,
    code_challenge_method: "S256",
    ...config.extraParams,
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
  id_token: z.string().optional(),
  scope: z.string().optional(),
});

export type OAuthTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  idToken: string | null;
  /** Permissions réellement accordées (le client peut en décocher chez Google). */
  grantedScopes: string[] | null;
};

export function parseTokenResponse(body: unknown, now: number): OAuthTokens | null {
  const parsed = tokenResponseSchema.safeParse(body);
  if (!parsed.success) return null;
  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token ?? null,
    expiresAt: new Date(now + parsed.data.expires_in * 1000).toISOString(),
    idToken: parsed.data.id_token ?? null,
    grantedScopes: parsed.data.scope ? parsed.data.scope.split(" ").filter(Boolean) : null,
  };
}

/**
 * Adresse contenue dans le jeton d'identité. Il vient directement du point d'accès du fournisseur,
 * en TLS, en échange du code : sa signature n'a pas à être revérifiée (OpenID Connect, § 3.1.3.7).
 */
const GOOGLE_ISSUERS: ReadonlySet<string> = new Set(["https://accounts.google.com", "accounts.google.com"]);

const idTokenClaimsSchema = z.object({
  iss: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
  exp: z.number(),
  email: z.email(),
  email_verified: z.boolean().optional(),
});

/**
 * Défense en profondeur (la signature n'est pas revérifiée, voir plus haut) : le jeton doit venir de
 * Google, être destiné à l'application de Relia et ne pas être expiré.
 */
export function emailFromIdToken(idToken: string, clientId: string, now = Date.now()): string | null {
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const parsed = idTokenClaimsSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (!parsed.success) return null;
    const claims = parsed.data;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const isValid =
      GOOGLE_ISSUERS.has(claims.iss) &&
      audiences.includes(clientId) &&
      claims.exp * 1000 > now &&
      claims.email_verified !== false;
    return isValid ? claims.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

type ClientCredentials = { clientId: string; clientSecret: string };

async function requestTokens(provider: OAuthProvider, params: Record<string, string>): Promise<OAuthTokens | null> {
  const response = await fetch(OAUTH_PROVIDERS[provider].tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(10_000),
  });
  const body: unknown = await response.json().catch(() => null);
  return response.ok ? parseTokenResponse(body, Date.now()) : null;
}

export function exchangeAuthorizationCode(
  provider: OAuthProvider,
  credentials: ClientCredentials,
  request: { code: string; redirectUri: string; codeVerifier: string },
): Promise<OAuthTokens | null> {
  return requestTokens(provider, {
    grant_type: "authorization_code",
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    code: request.code,
    redirect_uri: request.redirectUri,
    code_verifier: request.codeVerifier,
  });
}

/** Nouveau jeton d'accès ; null si le client a révoqué l'accès (la boîte passe alors en erreur). */
export function refreshAccessToken(
  provider: OAuthProvider,
  credentials: ClientCredentials,
  refreshToken: string,
): Promise<OAuthTokens | null> {
  return requestTokens(provider, {
    grant_type: "refresh_token",
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: refreshToken,
  });
}

/** Adresse et nom du compte Microsoft (le jeton d'identité ne contient pas toujours l'adresse). */
export async function fetchMicrosoftProfile(accessToken: string): Promise<{ email: string; name: string | null } | null> {
  const response = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const parsed = z
    .object({ mail: z.string().nullable().optional(), userPrincipalName: z.string(), displayName: z.string().nullable().optional() })
    .safeParse(await response.json().catch(() => null));
  if (!parsed.success) return null;
  const email = (parsed.data.mail ?? parsed.data.userPrincipalName).toLowerCase();
  return z.email().safeParse(email).success ? { email, name: parsed.data.displayName ?? null } : null;
}
