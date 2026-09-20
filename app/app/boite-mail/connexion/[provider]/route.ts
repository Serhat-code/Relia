import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireMember } from "@/lib/data/session";
import { getOAuthClient } from "@/lib/env";
import { buildAuthorizationUrl } from "@/lib/mail/oauth";
import { isOAuthProvider, isSecureSite, MAILBOX_PATH, mailboxErrorUrl, oauthRedirectUri } from "@/lib/mail/oauth-routes";
import { OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE_SECONDS, serializeOAuthStateCookie } from "@/lib/mail/oauth-state";
import { codeChallenge, createCodeVerifier, createState } from "@/lib/mail/pkce";

/**
 * Départ de la connexion de la boîte d'envoi : réservé au propriétaire et aux administrateurs.
 * `state` et vérificateur PKCE restent côté serveur, dans un cookie httpOnly limité à ces routes.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const member = await requireMember();
  const { provider } = await params;
  if (!isOAuthProvider(provider)) notFound();
  if (member.role === "member") redirect(mailboxErrorUrl("droits"));
  const client = getOAuthClient(provider);
  if (!client) redirect(mailboxErrorUrl("indisponible"));

  const state = createState();
  const verifier = createCodeVerifier();
  (await cookies()).set(OAUTH_STATE_COOKIE, serializeOAuthStateCookie({ state, verifier, provider, userId: member.id }), {
    httpOnly: true,
    secure: isSecureSite(),
    sameSite: "lax",
    path: MAILBOX_PATH,
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  redirect(
    buildAuthorizationUrl(provider, {
      clientId: client.clientId,
      redirectUri: oauthRedirectUri(provider),
      state,
      codeChallenge: await codeChallenge(verifier),
    }),
  );
}
