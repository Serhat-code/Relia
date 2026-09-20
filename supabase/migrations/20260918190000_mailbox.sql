-- Relia — boîte d'envoi du client (palier 9, CLAUDE.md §2.1 et §8).
--
-- Les relances partent de la boîte du client (Gmail, Outlook ou son serveur SMTP), jamais d'un
-- domaine Relia. Jetons et mot de passe vivent dans Vault ; ces fonctions sont réservées à la clé
-- de service (serveur), qui vérifie au préalable le rôle du membre.

-- Remplace la boîte de l'organisation en une transaction : secrets créés dans Vault, ancienne
-- boîte et ses secrets supprimés (déclencheur), connexion tracée. Rien d'orphelin en cas d'échec.
create function public.replace_email_account(
  p_organization_id uuid,
  p_actor_id uuid,
  p_provider public.email_provider,
  p_email_address text,
  p_display_name text,
  p_access_token text default null,
  p_refresh_token text default null,
  p_expires_at timestamptz default null,
  p_smtp_host text default null,
  p_smtp_port integer default null,
  p_smtp_user text default null,
  p_smtp_password text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_account_id uuid;
begin
  if p_provider = 'smtp' and p_smtp_password is null then
    raise exception 'Mot de passe SMTP manquant' using errcode = '22023';
  end if;
  if p_provider <> 'smtp' and (p_access_token is null or p_refresh_token is null) then
    raise exception 'Jetons OAuth manquants' using errcode = '22023';
  end if;

  delete from public.email_accounts where organization_id = p_organization_id;

  insert into public.email_accounts (
    organization_id, provider, email_address, display_name,
    oauth_access_token_secret_id, oauth_refresh_token_secret_id, oauth_expires_at,
    smtp_host, smtp_port, smtp_user, smtp_password_secret_id, status, last_verified_at
  )
  values (
    p_organization_id, p_provider, lower(btrim(p_email_address)), nullif(btrim(p_display_name), ''),
    case when p_provider <> 'smtp' then vault.create_secret(p_access_token) end,
    case when p_provider <> 'smtp' then vault.create_secret(p_refresh_token) end,
    case when p_provider <> 'smtp' then p_expires_at end,
    case when p_provider = 'smtp' then p_smtp_host end,
    case when p_provider = 'smtp' then p_smtp_port end,
    case when p_provider = 'smtp' then p_smtp_user end,
    case when p_provider = 'smtp' then vault.create_secret(p_smtp_password) end,
    'active', now()
  )
  returning id into new_account_id;

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (p_organization_id, 'user', p_actor_id, 'mailbox.connected', 'mailbox', new_account_id,
    jsonb_build_object('provider', p_provider));

  return new_account_id;
end;
$$;

-- Identifiants déchiffrés de la boîte d'une organisation, pour l'envoi (serveur uniquement).
create function public.email_account_credentials(p_organization_id uuid)
returns table (
  id uuid,
  provider public.email_provider,
  email_address text,
  display_name text,
  status public.connection_status,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  smtp_host text,
  smtp_port integer,
  smtp_user text,
  smtp_password text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    account.id, account.provider, account.email_address, account.display_name, account.status,
    access.decrypted_secret, refresh.decrypted_secret, account.oauth_expires_at,
    account.smtp_host, account.smtp_port, account.smtp_user, password.decrypted_secret
  from public.email_accounts as account
  left join vault.decrypted_secrets as access on access.id = account.oauth_access_token_secret_id
  left join vault.decrypted_secrets as refresh on refresh.id = account.oauth_refresh_token_secret_id
  left join vault.decrypted_secrets as password on password.id = account.smtp_password_secret_id
  where account.organization_id = p_organization_id
  order by account.created_at desc
  limit 1
$$;

-- Jeton d'accès renouvelé (et jeton de rafraîchissement, que Microsoft fait tourner).
create function public.store_email_account_tokens(
  p_organization_id uuid,
  p_account_id uuid,
  p_access_token text,
  p_expires_at timestamptz,
  p_refresh_token text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account public.email_accounts%rowtype;
begin
  -- L'organisation est revérifiée : un identifiant de boîte seul ne suffit pas.
  select * into account from public.email_accounts
  where id = p_account_id and organization_id = p_organization_id
  for update;
  if not found or account.provider = 'smtp' then
    raise exception 'Boîte OAuth introuvable' using errcode = 'P0002';
  end if;

  perform vault.update_secret(account.oauth_access_token_secret_id, p_access_token);
  if p_refresh_token is not null then
    perform vault.update_secret(account.oauth_refresh_token_secret_id, p_refresh_token);
  end if;
  update public.email_accounts set oauth_expires_at = p_expires_at where id = p_account_id;
end;
$$;

revoke all on function public.replace_email_account(uuid, uuid, public.email_provider, text, text, text, text, timestamptz, text, integer, text, text)
  from public, anon, authenticated;
revoke all on function public.email_account_credentials(uuid) from public, anon, authenticated;
revoke all on function public.store_email_account_tokens(uuid, uuid, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.replace_email_account(uuid, uuid, public.email_provider, text, text, text, text, timestamptz, text, integer, text, text)
  to service_role;
grant execute on function public.email_account_credentials(uuid) to service_role;
grant execute on function public.store_email_account_tokens(uuid, uuid, text, timestamptz, text) to service_role;
