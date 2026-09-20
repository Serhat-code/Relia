import "server-only";
import type { OAuthTokens } from "@/lib/mail/oauth";
import type { Database, Enums } from "@/lib/supabase/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Boîte d'envoi de l'organisation (§2.1 : les relances partent de l'adresse du client). Une seule
 * par organisation. Les membres la lisent (RLS) ; l'écriture et les secrets (jetons, mot de passe,
 * dans Vault) passent par le serveur, après vérification du rôle par l'appelant.
 */

export type MailProvider = Enums<"email_provider">;

export type Mailbox = {
  id: string;
  provider: MailProvider;
  emailAddress: string;
  displayName: string | null;
  status: Enums<"connection_status">;
  lastVerifiedAt: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  /** Serveur de lecture des réponses (repli SMTP) ; Gmail et Outlook les lisent par leur API. */
  imapHost: string | null;
  repliesCheckedAt: string | null;
  repliesError: string | null;
};

export async function getMailbox(): Promise<Mailbox | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("email_accounts")
    .select(
      "id, provider, email_address, display_name, status, last_verified_at, smtp_host, smtp_port, imap_host, replies_checked_at, replies_error",
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Lecture de la boîte d'envoi impossible : ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    provider: data.provider,
    emailAddress: data.email_address,
    displayName: data.display_name,
    status: data.status,
    lastVerifiedAt: data.last_verified_at,
    smtpHost: data.smtp_host,
    smtpPort: data.smtp_port,
    imapHost: data.imap_host,
    repliesCheckedAt: data.replies_checked_at,
    repliesError: data.replies_error,
  };
}

/** Membre qui agit, identifié par la session (jamais par un champ de formulaire). */
export type MailboxActor = { organizationId: string; userId: string };

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type MailboxMutation = { ok: true } | { ok: false; error: string };

const SAVE_FAILED = "La boîte d'envoi n'a pas pu être enregistrée.";

async function audit(admin: Admin, actor: MailboxActor, action: string) {
  const { error } = await admin.from("audit_logs").insert({
    organization_id: actor.organizationId,
    actor_type: "user",
    actor_id: actor.userId,
    action,
    entity_type: "mailbox",
  });
  if (error) console.error("Journal d'audit : écriture impossible", { action, message: error.message });
}

type ReplaceArgs = Database["public"]["Functions"]["replace_email_account"]["Args"];

/** Remplace la boîte de l'organisation en une transaction (secrets dans Vault, ancienne boîte effacée). */
async function replaceMailbox(args: ReplaceArgs): Promise<MailboxMutation> {
  const { error } = await createSupabaseAdminClient().rpc("replace_email_account", args);
  if (!error) return { ok: true };
  console.error("Enregistrement de la boîte d'envoi refusé par la base", { code: error.code, message: error.message });
  return { ok: false, error: SAVE_FAILED };
}

type OAuthMailboxInput = {
  provider: "gmail" | "outlook";
  emailAddress: string;
  displayName: string;
  tokens: OAuthTokens & { refreshToken: string };
};

export function saveOAuthMailbox(actor: MailboxActor, input: OAuthMailboxInput): Promise<MailboxMutation> {
  return replaceMailbox({
    p_organization_id: actor.organizationId,
    p_actor_id: actor.userId,
    p_provider: input.provider,
    p_email_address: input.emailAddress,
    p_display_name: input.displayName,
    p_access_token: input.tokens.accessToken,
    p_refresh_token: input.tokens.refreshToken,
    p_expires_at: input.tokens.expiresAt,
  });
}

type SmtpMailboxInput = {
  emailAddress: string;
  displayName: string;
  host: string;
  port: number;
  user: string;
  password: string;
  imapHost: string | null;
  imapPort: number | null;
};

export function saveSmtpMailbox(actor: MailboxActor, input: SmtpMailboxInput): Promise<MailboxMutation> {
  return replaceMailbox({
    p_organization_id: actor.organizationId,
    p_actor_id: actor.userId,
    p_provider: "smtp",
    p_email_address: input.emailAddress,
    p_display_name: input.displayName,
    p_smtp_host: input.host,
    p_smtp_port: input.port,
    p_smtp_user: input.user,
    p_smtp_password: input.password,
    ...(input.imapHost && input.imapPort ? { p_imap_host: input.imapHost, p_imap_port: input.imapPort } : {}),
  });
}

/** Déconnexion : réservée aux responsables par la RLS ; les secrets sont effacés par déclencheur. */
export async function disconnectMailbox(actor: MailboxActor): Promise<MailboxMutation> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("email_accounts")
    .delete()
    .eq("organization_id", actor.organizationId)
    .select("id");
  if (error) {
    console.error("Déconnexion de la boîte d'envoi refusée", { code: error.code, message: error.message });
    return { ok: false, error: "La boîte d'envoi n'a pas pu être déconnectée." };
  }
  if (data.length === 0) {
    return { ok: false, error: "Seuls le propriétaire et les administrateurs peuvent déconnecter la boîte d'envoi." };
  }
  await audit(createSupabaseAdminClient(), actor, "mailbox.disconnected");
  return { ok: true };
}
