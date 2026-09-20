-- Imitation minimale de l'environnement Supabase, pour tester les migrations dans PGlite
-- (PostgreSQL en WebAssembly, sans Docker). Reproduit ce dont dépendent les migrations :
-- rôles d'API et privilèges par défaut du schéma public, auth.uid(), auth.users/identities,
-- l'API de Vault et pgcrypto dans le schéma extensions.
-- Ne sert qu'aux tests : sur Supabase, tout ceci existe déjà.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Comme Supabase : tout objet créé dans public est accessible aux rôles d'API ; la RLS filtre.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- auth
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  instance_id uuid,
  id uuid primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  confirmation_token varchar(255),
  recovery_token varchar(255),
  email_change_token_new varchar(255),
  email_change varchar(255)
);

create table auth.identities (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

-- Vault : même interface que l'extension supabase_vault (ici sans chiffrement réel).
create schema vault;
revoke all on schema vault from public;

create table vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  description text not null default '',
  secret text not null,
  key_id uuid,
  nonce bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function vault.create_secret(
  new_secret text,
  new_name text default null,
  new_description text default '',
  new_key_id uuid default null
) returns uuid
language sql
as $$
  insert into vault.secrets (secret, name, description, key_id)
  values (new_secret, new_name, new_description, new_key_id)
  returning id
$$;

create function vault.update_secret(
  secret_id uuid,
  new_secret text default null,
  new_name text default null,
  new_description text default null,
  new_key_id uuid default null
) returns void
language sql
as $$
  update vault.secrets
  set secret = coalesce(new_secret, secret),
      name = coalesce(new_name, name),
      description = coalesce(new_description, description),
      key_id = coalesce(new_key_id, key_id),
      updated_at = now()
  where id = secret_id
$$;

create view vault.decrypted_secrets as
  select id, name, description, secret, secret as decrypted_secret, key_id, nonce, created_at, updated_at
  from vault.secrets;
