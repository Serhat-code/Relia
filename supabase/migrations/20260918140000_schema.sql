-- Relia — schéma initial (CLAUDE.md §4).
--
-- Toutes les tables portent organization_id. Les tables enfants référencent leur parent par
-- (id, organization_id) : une ligne ne peut pas pointer vers une ligne d'une autre organisation,
-- même si la RLS (migration suivante) était contournée.

create schema if not exists private;
revoke all on schema private from public;
comment on schema private is 'Fonctions internes (RLS, déclencheurs, purge) : jamais exposées par l''API.';
alter default privileges in schema private revoke execute on functions from public;

-- ─── Vocabulaires ──────────────────────────────────────────────────────────────

create type public.plan_tier as enum ('trial', 'starter', 'pro', 'business');
create type public.member_role as enum ('owner', 'admin', 'member');
create type public.client_type as enum ('b2b', 'b2c');
create type public.invoice_status as enum ('pending', 'late', 'promised', 'paid', 'disputed', 'cancelled');
create type public.invoice_source as enum ('manual', 'csv', 'pennylane', 'qonto', 'stripe', 'facturx');
create type public.reminder_tone as enum ('courtois', 'ferme', 'mise_en_demeure');
create type public.reminder_channel as enum ('email');
create type public.reminder_status as enum ('scheduled', 'awaiting_approval', 'sent', 'cancelled', 'failed');
create type public.promise_source as enum ('email_reply', 'manual');
create type public.actor_type as enum ('user', 'system', 'ai');
create type public.email_provider as enum ('gmail', 'outlook', 'smtp');
create type public.connection_status as enum ('pending', 'active', 'error', 'revoked');
create type public.integration_provider as enum ('pennylane', 'qonto', 'stripe', 'sellsy');

-- ─── Organisations et membres ──────────────────────────────────────────────────

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  siren text check (siren ~ '^[0-9]{9}$'),
  plan public.plan_tier not null default 'trial',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  -- §2.2 : DPA article 28 accepté à l'inscription, avec horodatage, version et adresse IP.
  dpa_accepted_at timestamptz not null,
  dpa_version text not null check (char_length(dpa_version) between 1 and 50),
  dpa_ip inet not null,
  -- §2.2 : conservation après la clôture d'une facture, 3 ans par défaut.
  retention_months smallint not null default 36 check (retention_months between 12 and 120),
  created_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  full_name text check (char_length(full_name) <= 200),
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  constraint users_id_organization_key unique (id, organization_id)
);

create index users_organization_id_idx on public.users (organization_id);

-- ─── Boîte d'envoi du client (§2.1 : jamais celle de Relia) et intégrations ─────
-- Les secrets ne sont jamais stockés ici : seulement l'identifiant de leur entrée
-- chiffrée dans Supabase Vault (voir la migration « secrets »).

create table public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider public.email_provider not null,
  email_address text not null check (email_address ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  display_name text,
  oauth_access_token_secret_id uuid,
  oauth_refresh_token_secret_id uuid,
  oauth_expires_at timestamptz,
  smtp_host text,
  smtp_port integer check (smtp_port between 1 and 65535),
  smtp_user text,
  smtp_password_secret_id uuid,
  status public.connection_status not null default 'pending',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint email_accounts_address_key unique (organization_id, email_address),
  constraint email_accounts_credentials_match_provider check (
    (provider = 'smtp' and smtp_host is not null and smtp_port is not null and smtp_user is not null
        and oauth_access_token_secret_id is null and oauth_refresh_token_secret_id is null)
    or (provider <> 'smtp' and smtp_host is null and smtp_port is null and smtp_user is null
        and smtp_password_secret_id is null)
  )
);

create index email_accounts_organization_id_idx on public.email_accounts (organization_id);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider public.integration_provider not null,
  credentials_secret_id uuid,
  status public.connection_status not null default 'pending',
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  constraint integrations_provider_key unique (organization_id, provider)
);

-- ─── Débiteurs et factures ─────────────────────────────────────────────────────

create table public.debtors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  siren text constraint debtors_siren_check check (siren ~ '^[0-9]{9}$'),
  -- Personne morale (société, association…). Une entreprise individuelle a un SIREN
  -- mais reste une personne physique : elle n'est pas une personne morale.
  is_legal_entity boolean not null default false,
  -- §2.5 : obligatoire, demandé à l'import.
  client_type public.client_type not null,
  contact_email text check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_name text,
  phone text,
  address text,
  risk_score smallint check (risk_score between 0 and 100),
  payment_behavior_days integer,
  notes text,
  created_at timestamptz not null default now(),
  constraint debtors_id_organization_key unique (id, organization_id),
  constraint debtors_legal_entity_has_siren check (not is_legal_entity or siren is not null),
  -- §2.4 : score de risque réservé aux personnes morales. Plus strict que la règle
  -- « B2B avec SIREN » : une entreprise individuelle (personne physique) est exclue.
  constraint debtors_risk_score_legal_entities_only check (
    risk_score is null or (client_type = 'b2b' and siren is not null and is_legal_entity)
  )
);

create index debtors_organization_id_idx on public.debtors (organization_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  debtor_id uuid not null,
  number text not null check (char_length(number) between 1 and 100),
  amount_ht numeric(14, 2) not null check (amount_ht >= 0),
  amount_ttc numeric(14, 2) not null,
  currency char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  issued_at date not null,
  due_at date not null,
  paid_at date,
  -- Date de clôture (payée ou annulée), point de départ de la durée de conservation.
  closed_at timestamptz,
  status public.invoice_status not null default 'pending',
  source public.invoice_source not null default 'manual',
  external_id text,
  factur_x_raw jsonb,
  created_at timestamptz not null default now(),
  constraint invoices_id_organization_key unique (id, organization_id),
  constraint invoices_number_key unique (organization_id, number),
  constraint invoices_debtor_fkey foreign key (debtor_id, organization_id)
    references public.debtors (id, organization_id) on delete cascade,
  constraint invoices_ttc_covers_ht check (amount_ttc >= amount_ht),
  constraint invoices_due_after_issue check (due_at >= issued_at),
  constraint invoices_paid_at_matches_status check ((status = 'paid') = (paid_at is not null))
);

create index invoices_organization_status_idx on public.invoices (organization_id, status);
create index invoices_organization_due_at_idx on public.invoices (organization_id, due_at);
create index invoices_debtor_id_idx on public.invoices (debtor_id);
create index invoices_closed_at_idx on public.invoices (closed_at) where closed_at is not null;
create unique index invoices_external_id_key on public.invoices (organization_id, source, external_id)
  where external_id is not null;

create function private.set_invoice_closed_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('paid', 'cancelled') then
    if tg_op = 'INSERT' or old.status not in ('paid', 'cancelled') then
      new.closed_at := now();
    else
      new.closed_at := old.closed_at;
    end if;
  else
    new.closed_at := null;
  end if;
  return new;
end;
$$;

create trigger invoices_set_closed_at
  before insert or update of status, closed_at on public.invoices
  for each row execute function private.set_invoice_closed_at();

-- ─── Scénarios, étapes et modèles de relance ───────────────────────────────────

create table public.reminder_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  client_type public.client_type not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  constraint reminder_sequences_id_organization_key unique (id, organization_id)
);

create unique index reminder_sequences_one_default
  on public.reminder_sequences (organization_id, client_type) where is_default;
create index reminder_sequences_organization_id_idx on public.reminder_sequences (organization_id);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  -- null : modèle système, fourni par Relia et visible de toutes les organisations.
  organization_id uuid references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  client_type public.client_type not null,
  tone public.reminder_tone not null,
  subject text not null,
  body_markdown text not null,
  variables jsonb not null default '[]'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  constraint templates_system_has_no_organization check (is_system = (organization_id is null))
);

create index templates_organization_id_idx on public.templates (organization_id);

create table public.reminder_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  sequence_id uuid not null,
  position smallint not null check (position >= 1),
  -- Jours relatifs à l'échéance ; négatif : avant l'échéance.
  offset_days smallint not null check (offset_days between -60 and 365),
  tone public.reminder_tone not null,
  template_id uuid references public.templates (id) on delete set null,
  channel public.reminder_channel not null default 'email',
  created_at timestamptz not null default now(),
  constraint reminder_steps_id_organization_key unique (id, organization_id),
  constraint reminder_steps_position_key unique (sequence_id, position),
  constraint reminder_steps_sequence_fkey foreign key (sequence_id, organization_id)
    references public.reminder_sequences (id, organization_id) on delete cascade
);

create index reminder_steps_template_id_idx on public.reminder_steps (template_id);
create index reminder_steps_organization_id_idx on public.reminder_steps (organization_id);

-- §2.5 : un scénario B2C ne peut pas utiliser un modèle B2B (et inversement), et le modèle
-- doit être un modèle système ou appartenir à la même organisation. Security definer :
-- la vérification voit toutes les lignes, pas seulement celles que la RLS laisse voir.
create function private.check_step_template() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  template_row public.templates%rowtype;
  sequence_client_type public.client_type;
begin
  if new.template_id is null then
    return new;
  end if;

  select * into template_row from public.templates where id = new.template_id;
  if not found or (template_row.organization_id is not null and template_row.organization_id <> new.organization_id) then
    raise exception 'Modèle % introuvable pour cette organisation', new.template_id using errcode = '23503';
  end if;

  select client_type into sequence_client_type from public.reminder_sequences where id = new.sequence_id;
  if template_row.client_type <> sequence_client_type then
    raise exception 'Le modèle (client_type %) ne correspond pas au scénario (client_type %)',
      template_row.client_type, sequence_client_type using errcode = '23514';
  end if;

  if template_row.tone <> new.tone then
    raise exception 'Le ton du modèle (%) diffère de celui de l''étape (%)', template_row.tone, new.tone
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger reminder_steps_check_template
  before insert or update of template_id, tone, sequence_id on public.reminder_steps
  for each row execute function private.check_step_template();

-- Symétrique : un modèle déjà utilisé par des étapes ne peut plus changer de type de client ni de ton.
create function private.check_template_usage() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.reminder_steps as step
    join public.reminder_sequences as sequence on sequence.id = step.sequence_id
    where step.template_id = new.id
      and (sequence.client_type <> new.client_type or step.tone <> new.tone)
  ) then
    raise exception 'Ce modèle est utilisé par des étapes de scénario : son type de client et son ton ne peuvent plus changer'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger templates_check_usage
  before update of client_type, tone on public.templates
  for each row execute function private.check_template_usage();

-- ─── Relances et promesses ─────────────────────────────────────────────────────

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_id uuid not null,
  step_id uuid,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  status public.reminder_status not null default 'scheduled',
  subject text,
  body text,
  ai_generated boolean not null default false,
  approved_by uuid,
  approved_at timestamptz,
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  constraint reminders_invoice_fkey foreign key (invoice_id, organization_id)
    references public.invoices (id, organization_id) on delete cascade,
  constraint reminders_step_fkey foreign key (step_id, organization_id)
    references public.reminder_steps (id, organization_id) on delete set null (step_id),
  constraint reminders_approver_fkey foreign key (approved_by, organization_id)
    references public.users (id, organization_id) on delete set null (approved_by),
  constraint reminders_sent_has_timestamp check ((status = 'sent') = (sent_at is not null)),
  constraint reminders_approver_has_timestamp check (approved_by is null or approved_at is not null)
);

create index reminders_organization_id_idx on public.reminders (organization_id);
create index reminders_invoice_id_idx on public.reminders (invoice_id);
create index reminders_due_idx on public.reminders (scheduled_at) where status = 'scheduled';
create index reminders_step_id_idx on public.reminders (step_id);
create index reminders_approved_by_idx on public.reminders (approved_by);

-- §2.3 : l'approbation humaine d'une relance ne se signe qu'en son propre nom, et son
-- horodatage est posé par la base. La clé de service (crons) n'a pas d'utilisateur : elle
-- peut renseigner l'approbation reçue par un autre canal.
create function private.guard_reminder_approval() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  acting_user uuid := (select auth.uid());
begin
  if tg_op = 'UPDATE' and new.approved_by is not distinct from old.approved_by then
    new.approved_at := old.approved_at;
    return new;
  end if;

  if new.approved_by is null then
    new.approved_at := null;
    return new;
  end if;

  if acting_user is not null then
    if new.approved_by <> acting_user then
      raise exception 'Une relance ne peut être approuvée qu''en son propre nom' using errcode = '42501';
    end if;
    new.approved_at := now();
  elsif new.approved_at is null then
    new.approved_at := now();
  end if;

  return new;
end;
$$;

create trigger reminders_guard_approval
  before insert or update of approved_by, approved_at on public.reminders
  for each row execute function private.guard_reminder_approval();

create table public.promises (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_id uuid not null,
  promised_amount numeric(14, 2) check (promised_amount > 0),
  promised_date date not null,
  source public.promise_source not null,
  -- Confiance de la détection automatique (0 à 1) : porte sur l'extraction, pas sur une personne.
  confidence numeric(3, 2) check (confidence between 0 and 1),
  kept boolean,
  created_at timestamptz not null default now(),
  constraint promises_invoice_fkey foreign key (invoice_id, organization_id)
    references public.invoices (id, organization_id) on delete cascade
);

create index promises_invoice_id_idx on public.promises (invoice_id);
create index promises_organization_id_idx on public.promises (organization_id);

-- ─── Journal d'audit (§2.2 : immuable, insertion seule) ────────────────────────

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_type public.actor_type not null,
  actor_id uuid,
  action text not null check (char_length(action) between 1 and 100),
  entity_type text not null check (char_length(entity_type) between 1 and 50),
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_organization_created_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- Aucune modification ni suppression, quel que soit le rôle (superutilisateur compris),
-- sauf la purge de conservation, qui lève le verrou pour sa seule transaction.
create function private.prevent_audit_log_mutation() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('relia.allow_audit_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'Le journal d''audit est immuable (% refusé)', tg_op using errcode = '42501';
end;
$$;

create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function private.prevent_audit_log_mutation();

create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function private.prevent_audit_log_mutation();

-- Purge des entrées au-delà de la durée de conservation (appelée par le cron de purge, palier 15).
create function private.purge_audit_logs(p_organization_id uuid, p_before timestamptz) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  purged integer;
begin
  perform set_config('relia.allow_audit_purge', 'on', true);
  delete from public.audit_logs where organization_id = p_organization_id and created_at < p_before;
  get diagnostics purged = row_count;
  perform set_config('relia.allow_audit_purge', 'off', true);
  return purged;
end;
$$;

-- Effacement complet d'une organisation (droit à l'effacement, fin de contrat) : la suppression
-- en cascade traverse le journal d'audit, dont le verrou est levé pour cette seule opération.
-- Les comptes d'authentification (auth.users) sont supprimés à part, par l'API d'administration.
create function private.delete_organization(p_organization_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('relia.allow_audit_purge', 'on', true);
  delete from public.organizations where id = p_organization_id;
  perform set_config('relia.allow_audit_purge', 'off', true);
end;
$$;
