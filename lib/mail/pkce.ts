/** PKCE (RFC 7636) : le code d'autorisation ne sert qu'à qui détient le vérificateur. */

const toBase64Url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

/** 32 octets aléatoires → 43 caractères base64url (le minimum de la RFC). */
export function createCodeVerifier(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}

/** Valeur aléatoire du paramètre `state` (protection contre la falsification de requête). */
export function createState(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
}
