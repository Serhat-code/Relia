-- Relia — secrets chiffrés (CLAUDE.md §8 : jamais en clair).
--
-- Jetons OAuth, mots de passe SMTP et identifiants d'intégration sont stockés dans Supabase Vault
-- (chiffrement authentifié sur disque ; sauvegardes et réplication restent chiffrées). Les tables
-- ne gardent que l'identifiant de l'entrée Vault.
--
-- Écart assumé avec le §8, qui cite pgsodium : Supabase ne recommande plus pgsodium (dépréciation
-- annoncée) et oriente vers Vault, dont l'interface reste stable.
--
-- Les fonctions ci-dessous sont réservées à la clé de service (serveur, crons) : ni les visiteurs
-- ni les utilisateurs connectés ne peuvent lire ou écrire un secret.

create function public.vault_store_secret(p_secret text) returns uuid
language sql
security definer
set search_path = ''
as $$
  select vault.create_secret(p_secret)
$$;

create function public.vault_read_secret(p_secret_id uuid) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_secret_id
$$;

create function public.vault_update_secret(p_secret_id uuid, p_secret text) returns void
language sql
security definer
set search_path = ''
as $$
  select vault.update_secret(p_secret_id, p_secret)
$$;

create function public.vault_delete_secret(p_secret_id uuid) returns void
language sql
security definer
set search_path = ''
as $$
  delete from vault.secrets where id = p_secret_id
$$;

revoke all on function public.vault_store_secret(text) from public, anon, authenticated;
revoke all on function public.vault_read_secret(uuid) from public, anon, authenticated;
revoke all on function public.vault_update_secret(uuid, text) from public, anon, authenticated;
revoke all on function public.vault_delete_secret(uuid) from public, anon, authenticated;
grant execute on function public.vault_store_secret(text) to service_role;
grant execute on function public.vault_read_secret(uuid) to service_role;
grant execute on function public.vault_update_secret(uuid, text) to service_role;
grant execute on function public.vault_delete_secret(uuid) to service_role;

-- Supprimer une boîte d'envoi ou une intégration supprime ses secrets : aucun jeton orphelin.

create function private.delete_email_account_secrets() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets
  where id in (old.oauth_access_token_secret_id, old.oauth_refresh_token_secret_id, old.smtp_password_secret_id);
  return old;
end;
$$;

create trigger email_accounts_delete_secrets
  after delete on public.email_accounts
  for each row execute function private.delete_email_account_secrets();

create function private.delete_integration_secrets() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets where id = old.credentials_secret_id;
  return old;
end;
$$;

create trigger integrations_delete_secrets
  after delete on public.integrations
  for each row execute function private.delete_integration_secrets();
