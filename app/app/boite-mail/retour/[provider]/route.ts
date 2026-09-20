import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { saveOAuthMailbox } from "@/lib/data/mailbox";
import { requireMember } from "@/lib/data/session";
import { getOAuthClient } from "@/lib/env";
import { canSendWith, emailFromIdToken, exchangeAuthorizationCode, fetchMicrosoftProfile } from "@/lib/mail/oauth";
import { isOAuthProvider, MAILBOX_PATH, mailboxErrorUrl, oauthRedirectUri } from "@/lib/mail/oauth-routes";
import { OAUTH_STATE_COOKIE, parseOAuthStateCookie } from "@/lib/mail/oauth-state";

/**
 * Retour de Google ou Microsoft : le `state` doit correspondre au cookie posé au départ, pour le
 * même membre et le même fournisseur (sinon, un retour forgé rattacherait la boîte d'un tiers).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const member = await requireMember();
  const { provider } = await params;
  if (!isOAuthProvider(provider)) notFound();

  const jar = await cookies();
  const saved = parseOAuthStateCookie(jar.get(OAUTH_STATE_COOKIE)?.value);
  jar.set(OAUTH_STATE_COOKIE, "", { path: MAILBOX_PATH, maxAge: 0 });

  const search = request.nextUrl.searchParams;
  if (search.get("error")) redirect(mailboxErrorUrl("refus"));
  const code = search.get("code");
  const isValidState =
    saved !== null && saved.provider === provider && saved.userId === member.id && saved.state === search.get("state");
  if (!code || !isValidState) redirect(mailboxErrorUrl("etat"));
  if (member.role === "member") redirect(mailboxErrorUrl("droits"));
  const client = getOAuthClient(provider);
  if (!client) redirect(mailboxErrorUrl("indisponible"));

  const tokens = await exchangeAuthorizationCode(provider, client, {
    code,
    redirectUri: oauthRedirectUri(provider),
    codeVerifier: saved.verifier,
  });
  if (!tokens?.refreshToken) redirect(mailboxErrorUrl("echange"));
  if (!canSendWith(provider, tokens)) redirect(mailboxErrorUrl("permissions"));

  const emailAddress =
    provider === "google"
      ? tokens.idToken && emailFromIdToken(tokens.idToken, client.clientId)
      : (await fetchMicrosoftProfile(tokens.accessToken))?.email;
  if (!emailAddress) redirect(mailboxErrorUrl("adresse"));

  const result = await saveOAuthMailbox(
    { organizationId: member.organization.id, userId: member.id },
    {
      provider: provider === "google" ? "gmail" : "outlook",
      emailAddress,
      displayName: member.organization.name,
      tokens: { ...tokens, refreshToken: tokens.refreshToken },
    },
  );
  if (!result.ok) redirect(mailboxErrorUrl("enregistrement"));
  redirect(`${MAILBOX_PATH}?connectee=1`);
}
