import "server-only";
import { getOAuthClient } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken, type OAuthProvider } from "./oauth";

/**
 * Accès à la boîte de l'organisation, pour envoyer les relances et lire les réponses (§2.1).
 * Réservé au serveur (clé de service) : les secrets sont déchiffrés depuis Vault.
 */

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type MailboxCredentials = Database["public"]["Functions"]["email_account_credentials"]["Returns"][number];

/** Marge avant expiration : un jeton qui expire dans la minute est renouvelé avant l'appel. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;

const OAUTH_PROVIDER: Readonly<Record<"gmail" | "outlook", OAuthProvider>> = { gmail: "google", outlook: "microsoft" };

export const RECONNECT_MESSAGE = "La boîte d'envoi doit être reconnectée : l'accès a été refusé.";

export async function loadMailboxCredentials(admin: Admin, organizationId: string): Promise<MailboxCredentials | null> {
  const { data, error } = await admin.rpc("email_account_credentials", { p_organization_id: organizationId });
  if (error) throw new Error(`Lecture de la boîte d'envoi impossible : ${error.message}`);
  return data[0] ?? null;
}

export async function markMailboxStatus(admin: Admin, accountId: string, status: "active" | "error") {
  const { error } = await admin
    .from("email_accounts")
    .update(status === "active" ? { status, last_verified_at: new Date().toISOString() } : { status })
    .eq("id", accountId);
  if (error) console.error("Statut de la boîte d'envoi : mise à jour impossible", { message: error.message });
}

/** Jeton d'accès valide, renouvelé si besoin ; null si le renouvellement échoue (accès retiré). */
export async function currentAccessToken(admin: Admin, organizationId: string, account: MailboxCredentials): Promise<string | null> {
  if (account.provider === "smtp" || !account.access_token || !account.refresh_token) return null;
  const expiresAt = account.expires_at ? Date.parse(account.expires_at) : 0;
  if (expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) return account.access_token;

  const provider = OAUTH_PROVIDER[account.provider];
  const client = getOAuthClient(provider);
  if (!client) return null;
  const tokens = await refreshAccessToken(provider, client, account.refresh_token);
  if (!tokens) return null;

  const { error } = await admin.rpc("store_email_account_tokens", {
    p_organization_id: organizationId,
    p_account_id: account.id,
    p_access_token: tokens.accessToken,
    p_expires_at: tokens.expiresAt,
    ...(tokens.refreshToken ? { p_refresh_token: tokens.refreshToken } : {}),
  });
  if (error) console.error("Jeton renouvelé mais non enregistré", { message: error.message });
  return tokens.accessToken;
}
