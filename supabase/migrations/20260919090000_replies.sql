-- Relia — réponses des clients et promesses de règlement (palier 11, CLAUDE.md §5.6).
--
-- Les réponses aux relances sont lues dans la boîte du client (Gmail, Outlook, ou IMAP en repli SMTP),
-- rattachées à la relance d'origine, puis classées : promesse de règlement, règlement annoncé,
-- contestation, autre réponse, message automatique, avis de non-remise.
--
-- 1. Toute vraie réponse suspend les relances de la facture jusqu'à ce qu'un membre la traite.
-- 2. Une promesse datée met la facture « sous promesse » jusqu'à sa date, plus un délai de grâce ;
--    passé ce délai sans règlement, la promesse est « non tenue » et les relances reprennent.
-- 3. Minimisation : seul un extrait de ce que le client a écrit est conservé, jamais le message entier,
--    et rien pour un message d'absence.

-- ─── Boîte d'envoi : lecture des réponses ──────────────────────────────────────

-- Repli SMTP : les réponses se lisent sur le serveur IMAP de la messagerie du client (mêmes identifiants).
-- Gmail et Outlook les lisent par leur API, avec l'autorisation accordée à la connexion.
alter table public.email_accounts
  add column imap_host text,
  add column imap_port integer check (imap_port between 1 and 65535),
  -- Dernière lecture réussie des réponses, et motif du dernier échec (affiché au client).
  add column replies_checked_at timestamptz,
  add column replies_error text check (char_length(replies_error) <= 300),
  add constraint email_accounts_imap_for_smtp check (
    (imap_host is null and imap_port is null)
    or (provider = 'smtp' and imap_host is not null and imap_port is not null)
  );

drop function public.replace_email_account(uuid, uuid, public.email_provider, text, text, text, text, timestamptz, text, integer, text, text);

-- Remplace la boîte de l'organisation en une transaction (voir la migration « mailbox ») ; le serveur
-- IMAP, facultatif, n'existe qu'en repli SMTP.
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
  p_smtp_password text default null,
  p_imap_host text default null,
  p_imap_port integer default null
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
    smtp_host, smtp_port, smtp_user, smtp_password_secret_id, imap_host, imap_port, status, last_verified_at
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
    case when p_provider = 'smtp' and p_imap_port is not null then nullif(btrim(p_imap_host), '') end,
    case when p_provider = 'smtp' and nullif(btrim(p_imap_host), '') is not null then p_imap_port end,
    'active', now()
  )
  returning id into new_account_id;

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (p_organization_id, 'user', p_actor_id, 'mailbox.connected', 'mailbox', new_account_id,
    jsonb_build_object('provider', p_provider, 'reads_replies', p_provider <> 'smtp' or p_imap_host is not null));

  return new_account_id;
end;
$$;

revoke all on function public.replace_email_account(uuid, uuid, public.email_provider, text, text, text, text, timestamptz, text, integer, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.replace_email_account(uuid, uuid, public.email_provider, text, text, text, text, timestamptz, text, integer, text, text, text, integer)
  to service_role;

-- ─── Suspension des relances d'une facture ─────────────────────────────────────

-- Posée quand le client répond : plus aucune relance n'est préparée ni envoyée pour la facture tant
-- qu'un membre n'a pas repris la main (reprise, promesse, litige, règlement).
alter table public.invoices add column reminders_paused_at timestamptz;

-- Une facture qui sort du cycle de relance (réglée, contestée, annulée) n'a plus de pause à lever :
-- si elle est rouverte, les relances reprennent normalement.
create function private.clear_pause_when_closed() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('paid', 'disputed', 'cancelled') then
    new.reminders_paused_at := null;
  end if;
  return new;
end;
$$;

create trigger invoices_clear_pause
  before update of status on public.invoices
  for each row execute function private.clear_pause_when_closed();

-- Rattachement composite des réponses à leur relance (même organisation, même hors RLS).
alter table public.reminders add constraint reminders_id_organization_key unique (id, organization_id);

-- ─── Réponses ──────────────────────────────────────────────────────────────────

create type public.reply_kind as enum ('promise', 'paid_claim', 'dispute', 'other', 'auto_reply', 'bounce');
create type public.reply_status as enum ('new', 'handled');

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null,
  reminder_id uuid,
  -- Identifiant du message chez le fournisseur : une réponse n'est enregistrée qu'une fois.
  provider_message_id text not null check (char_length(provider_message_id) between 1 and 500),
  received_at timestamptz not null,
  kind public.reply_kind not null,
  -- Extrait de ce que le client a écrit (sans la relance citée) ; rien pour un message d'absence.
  excerpt text check (char_length(excerpt) <= 500),
  -- Classement par l'IA (Mistral, UE) ou par des règles ; la confiance porte sur le message, pas sur la personne.
  ai_classified boolean not null default false,
  confidence numeric(3, 2) check (confidence between 0 and 1),
  status public.reply_status not null default 'new',
  handled_at timestamptz,
  handled_by uuid,
  created_at timestamptz not null default now(),
  constraint replies_id_organization_key unique (id, organization_id),
  constraint replies_message_key unique (organization_id, provider_message_id),
  constraint replies_invoice_fkey foreign key (invoice_id, organization_id)
    references public.invoices (id, organization_id) on delete cascade,
  constraint replies_reminder_fkey foreign key (reminder_id, organization_id)
    references public.reminders (id, organization_id) on delete set null (reminder_id),
  constraint replies_handler_fkey foreign key (handled_by, organization_id)
    references public.users (id, organization_id) on delete set null (handled_by),
  constraint replies_handled_has_timestamp check ((status = 'handled') = (handled_at is not null)),
  constraint replies_auto_reply_without_excerpt check (kind <> 'auto_reply' or excerpt is null)
);

create index replies_organization_status_idx on public.replies (organization_id, status, received_at desc);
create index replies_invoice_id_idx on public.replies (invoice_id);
create index replies_reminder_id_idx on public.replies (reminder_id);
create index replies_handled_by_idx on public.replies (handled_by);

alter table public.replies enable row level security;

create policy "Membres : réponses de leur organisation"
  on public.replies for select to authenticated
  using (organization_id = (select private.current_organization_id()));

-- Écriture réservée au serveur (lecture des boîtes) et aux fonctions ci-dessous.
revoke insert, update, delete on public.replies from authenticated;

-- ─── Promesses ─────────────────────────────────────────────────────────────────

-- Réponse d'où vient la promesse (détectée, ou saisie par un membre en traitant la réponse).
alter table public.promises
  add column reply_id uuid,
  add constraint promises_reply_fkey foreign key (reply_id, organization_id)
    references public.replies (id, organization_id) on delete set null (reply_id);

create index promises_reply_id_idx on public.promises (reply_id);

-- Une promesse change le statut de la facture : elle passe par les fonctions ci-dessous.
revoke insert, update, delete on public.promises from authenticated;

-- Délai de grâce après la date promise (virement en cours) : même valeur que PROMISE_GRACE_DAYS
-- (lib/replies/promises.ts), parité vérifiée par test.
create function private.promise_grace_days() returns integer
language sql
immutable
set search_path = ''
as $$
  select 3
$$;

-- Enregistre une promesse : la facture passe « sous promesse » (le déclencheur des factures annule
-- ses relances en attente) et la pause est levée — la promesse gouverne désormais le suivi.
create function private.apply_promise(
  p_organization_id uuid,
  p_invoice_id uuid,
  p_promised_date date,
  p_promised_amount numeric,
  p_source public.promise_source,
  p_confidence numeric,
  p_reply_id uuid,
  p_actor_type public.actor_type,
  p_actor_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_promise_id uuid;
begin
  insert into public.promises (organization_id, invoice_id, promised_amount, promised_date, source, confidence, reply_id)
  values (p_organization_id, p_invoice_id, p_promised_amount, p_promised_date, p_source, p_confidence, p_reply_id)
  returning id into new_promise_id;

  update public.invoices
  set status = 'promised', reminders_paused_at = null
  where id = p_invoice_id and organization_id = p_organization_id;

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (p_organization_id, p_actor_type, p_actor_id, 'promise.recorded', 'promise', new_promise_id,
    jsonb_build_object('invoice_id', p_invoice_id, 'promised_date', p_promised_date, 'source', p_source,
      'has_amount', p_promised_amount is not null));

  return new_promise_id;
end;
$$;

-- Règlement : chaque promesse en cours est tenue si le paiement est arrivé au plus tard à sa date
-- (délai de grâce compris). Les réponses encore à traiter le sont d'office : la facture sort du cycle.
create function private.close_follow_up() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' then
    update public.promises
    set kept = new.paid_at <= promised_date + private.promise_grace_days()
    where invoice_id = new.id and kept is null;
  end if;

  if new.status in ('paid', 'disputed', 'cancelled') then
    update public.replies
    set status = 'handled', handled_at = now(), handled_by = (select auth.uid())
    where invoice_id = new.id and status = 'new';
  end if;
  return null;
end;
$$;

create trigger invoices_close_follow_up
  after update of status on public.invoices
  for each row
  when (new.status is distinct from old.status)
  execute function private.close_follow_up();

-- ─── Enregistrement d'une réponse (clé de service) ─────────────────────────────

-- Réponse lue dans la boîte du client, rattachée à la relance envoyée. Renvoie null si elle est déjà
-- enregistrée (lectures qui se chevauchent). Une promesse datée est appliquée ; toute autre vraie
-- réponse suspend les relances de la facture ; un message d'absence est classé sans effet.
create function public.record_reply(
  p_organization_id uuid,
  p_reminder_id uuid,
  p_provider_message_id text,
  p_received_at timestamptz,
  p_kind public.reply_kind,
  p_excerpt text default null,
  p_ai_classified boolean default false,
  p_confidence numeric default null,
  p_promised_date date default null,
  p_promised_amount numeric default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  reminder public.reminders%rowtype;
  invoice public.invoices%rowtype;
  received_on date := (p_received_at at time zone 'Europe/Paris')::date;
  is_open boolean;
  applies_promise boolean;
  pauses boolean;
  cancelled_count integer := 0;
  new_reply_id uuid;
  actor public.actor_type := case when p_ai_classified then 'ai'::public.actor_type else 'system'::public.actor_type end;
begin
  select * into reminder from public.reminders
  where id = p_reminder_id and organization_id = p_organization_id;
  if not found or reminder.status <> 'sent' then
    raise exception 'Relance d''origine introuvable' using errcode = 'P0002';
  end if;
  if p_promised_date is not null and (p_kind <> 'promise' or p_promised_date not between received_on and received_on + 366) then
    raise exception 'Date de promesse invalide' using errcode = '22023';
  end if;

  -- Verrou de la facture : une réponse et un changement de statut simultanés ne se croisent pas.
  select * into invoice from public.invoices where id = reminder.invoice_id for update;
  if p_promised_amount is not null and (p_promised_amount <= 0 or p_promised_amount > invoice.amount_ttc) then
    raise exception 'Montant promis invalide' using errcode = '22023';
  end if;

  is_open := invoice.status in ('pending', 'late', 'promised');
  applies_promise := p_kind = 'promise' and p_promised_date is not null and is_open;
  pauses := p_kind <> 'auto_reply' and not applies_promise and is_open;

  insert into public.replies (
    organization_id, invoice_id, reminder_id, provider_message_id, received_at, kind, excerpt,
    ai_classified, confidence, status, handled_at
  )
  values (
    p_organization_id, invoice.id, reminder.id, p_provider_message_id, p_received_at, p_kind,
    case when p_kind <> 'auto_reply' then left(nullif(btrim(p_excerpt), ''), 500) end,
    p_ai_classified, p_confidence,
    case when p_kind = 'auto_reply' or applies_promise then 'handled'::public.reply_status else 'new'::public.reply_status end,
    case when p_kind = 'auto_reply' or applies_promise then now() end
  )
  on conflict on constraint replies_message_key do nothing
  returning id into new_reply_id;

  if new_reply_id is null then
    return null;
  end if;

  if applies_promise then
    perform private.apply_promise(p_organization_id, invoice.id, p_promised_date, p_promised_amount,
      'email_reply', p_confidence, new_reply_id, actor, null);
  elsif pauses then
    update public.invoices set reminders_paused_at = coalesce(reminders_paused_at, now()) where id = invoice.id;
    update public.reminders set status = 'cancelled'
    where invoice_id = invoice.id and status in ('scheduled', 'awaiting_approval');
    get diagnostics cancelled_count = row_count;
  end if;

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (p_organization_id, actor, null, 'reply.received', 'reply', new_reply_id,
    jsonb_build_object('invoice_id', invoice.id, 'kind', p_kind, 'promise_recorded', applies_promise,
      'paused', pauses, 'reminders_cancelled', cancelled_count));

  return new_reply_id;
end;
$$;

-- ─── Actions des membres ───────────────────────────────────────────────────────

-- Reprise des relances d'une facture : pause levée, réponses en attente classées, et promesse en
-- cours abandonnée (considérée comme non tenue) si la facture était sous promesse.
create function private.resume_invoice_reminders(p_organization_id uuid, p_invoice_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice public.invoices%rowtype;
  closed_promises integer := 0;
begin
  select * into invoice from public.invoices
  where id = p_invoice_id and organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'Facture introuvable' using errcode = 'P0002';
  end if;
  if invoice.reminders_paused_at is null and invoice.status <> 'promised' then
    raise exception 'Les relances de cette facture ne sont pas suspendues' using errcode = '22023';
  end if;

  if invoice.status = 'promised' then
    update public.promises set kept = false where invoice_id = p_invoice_id and kept is null;
    get diagnostics closed_promises = row_count;
  end if;

  update public.invoices
  set reminders_paused_at = null,
      status = case when status = 'promised' then private.effective_invoice_status('pending', due_at) else status end
  where id = p_invoice_id;

  update public.replies
  set status = 'handled', handled_at = now(), handled_by = p_actor_id
  where invoice_id = p_invoice_id and status = 'new';

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (p_organization_id, 'user', p_actor_id, 'invoice.reminders_resumed', 'invoice', p_invoice_id,
    jsonb_build_object('promises_abandoned', closed_promises));
end;
$$;

create function public.resume_reminders(p_invoice_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization uuid := (select private.current_organization_id());
  acting_user uuid := (select auth.uid());
begin
  if organization is null or acting_user is null then
    raise exception 'Aucune organisation pour cet utilisateur' using errcode = '42501';
  end if;
  perform private.resume_invoice_reminders(organization, p_invoice_id, acting_user);
end;
$$;

-- Promesse notée par un membre (appel, courrier, ou réponse dont la date n'a pas été lue).
create function public.record_promise(
  p_invoice_id uuid,
  p_promised_date date,
  p_promised_amount numeric default null,
  p_reply_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization uuid := (select private.current_organization_id());
  acting_user uuid := (select auth.uid());
  paris_today date := (now() at time zone 'Europe/Paris')::date;
  invoice public.invoices%rowtype;
  new_promise_id uuid;
begin
  if organization is null or acting_user is null then
    raise exception 'Aucune organisation pour cet utilisateur' using errcode = '42501';
  end if;
  select * into invoice from public.invoices
  where id = p_invoice_id and organization_id = organization
  for update;
  if not found then
    raise exception 'Facture introuvable' using errcode = 'P0002';
  end if;
  if invoice.status not in ('pending', 'late', 'promised') then
    raise exception 'Une promesse ne s''enregistre que pour une facture à régler' using errcode = '22023';
  end if;
  if p_promised_date is null or p_promised_date < paris_today or p_promised_date > paris_today + 365 then
    raise exception 'Date de promesse invalide' using errcode = '22023';
  end if;
  if p_promised_amount is not null and (p_promised_amount <= 0 or p_promised_amount > invoice.amount_ttc) then
    raise exception 'Montant promis invalide' using errcode = '22023';
  end if;
  if p_reply_id is not null then
    perform 1 from public.replies
    where id = p_reply_id and organization_id = organization and invoice_id = p_invoice_id and status = 'new'
    for update;
    if not found then
      raise exception 'Réponse introuvable ou déjà traitée' using errcode = 'P0002';
    end if;
  end if;

  new_promise_id := private.apply_promise(organization, p_invoice_id, p_promised_date, p_promised_amount,
    'manual', null, p_reply_id, 'user', acting_user);

  if p_reply_id is not null then
    update public.replies set status = 'handled', handled_at = now(), handled_by = acting_user where id = p_reply_id;
  end if;
  return new_promise_id;
end;
$$;

-- Traitement d'une réponse : laisser les relances en pause, les reprendre, signaler un litige ou
-- noter le règlement (mêmes transitions que change_invoice_status).
create function public.resolve_reply(p_reply_id uuid, p_resolution text, p_paid_at date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization uuid := (select private.current_organization_id());
  acting_user uuid := (select auth.uid());
  reply public.replies%rowtype;
begin
  if organization is null or acting_user is null then
    raise exception 'Aucune organisation pour cet utilisateur' using errcode = '42501';
  end if;
  if p_resolution is null or p_resolution not in ('keep_paused', 'resume', 'dispute', 'paid') then
    raise exception 'Action inconnue : %', p_resolution using errcode = '22023';
  end if;
  select * into reply from public.replies
  where id = p_reply_id and organization_id = organization
  for update;
  if not found then
    raise exception 'Réponse introuvable' using errcode = 'P0002';
  end if;
  if reply.status <> 'new' then
    raise exception 'Cette réponse a déjà été traitée' using errcode = '22023';
  end if;

  if p_resolution = 'resume' then
    perform private.resume_invoice_reminders(organization, reply.invoice_id, acting_user);
  elsif p_resolution = 'dispute' then
    perform public.change_invoice_status(reply.invoice_id, 'mark_disputed');
  elsif p_resolution = 'paid' then
    perform public.change_invoice_status(reply.invoice_id, 'mark_paid', p_paid_at);
  end if;

  -- Une reprise, un litige ou un règlement ont déjà classé les réponses de la facture.
  update public.replies
  set status = 'handled', handled_at = now(), handled_by = acting_user
  where id = p_reply_id and status = 'new';

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (organization, 'user', acting_user, 'reply.resolved', 'reply', p_reply_id,
    jsonb_build_object('invoice_id', reply.invoice_id, 'resolution', p_resolution));
end;
$$;

-- ─── Promesses échues (cron quotidien, clé de service) ─────────────────────────

-- Une facture sous promesse dont toutes les promesses en cours sont dépassées (délai de grâce
-- compris) redevient due : promesses non tenues, relances reprises. Toutes les organisations (cron),
-- ou une seule (avant de préparer ses relances). Renvoie le nombre de factures concernées.
create function public.settle_due_promises(p_organization_id uuid default null) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  paris_today date := (now() at time zone 'Europe/Paris')::date;
  candidate record;
  settled integer := 0;
begin
  for candidate in
    select invoice.id, invoice.organization_id
    from public.invoices as invoice
    where invoice.status = 'promised'
      and (p_organization_id is null or invoice.organization_id = p_organization_id)
      and exists (select 1 from public.promises as promise where promise.invoice_id = invoice.id and promise.kept is null)
      and not exists (
        select 1 from public.promises as promise
        where promise.invoice_id = invoice.id
          and promise.kept is null
          and promise.promised_date + private.promise_grace_days() >= paris_today
      )
    for update of invoice skip locked
  loop
    update public.promises set kept = false where invoice_id = candidate.id and kept is null;
    update public.invoices set status = private.effective_invoice_status('pending', due_at) where id = candidate.id;
    insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
    values (candidate.organization_id, 'system', null, 'promise.broken', 'invoice', candidate.id, '{}'::jsonb);
    settled := settled + 1;
  end loop;
  return settled;
end;
$$;

-- ─── Droit d'accès (§2.2) : l'export d'un débiteur comprend ses réponses ───────

create or replace function public.export_debtor(p_debtor_id uuid) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  organization uuid := (select private.current_organization_id());
  document jsonb;
begin
  select jsonb_build_object(
    'exported_at', now(),
    'debtor', to_jsonb(debtor) - 'organization_id',
    'invoices', coalesce((
      select jsonb_agg(to_jsonb(invoice) - 'organization_id' - 'debtor_id' order by invoice.issued_at)
      from public.invoices as invoice where invoice.debtor_id = debtor.id
    ), '[]'::jsonb),
    'reminders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'invoice_id', reminder.invoice_id, 'scheduled_at', reminder.scheduled_at, 'sent_at', reminder.sent_at,
        'status', reminder.status, 'subject', reminder.subject, 'body', reminder.body,
        'ai_generated', reminder.ai_generated
      ) order by reminder.scheduled_at)
      from public.reminders as reminder
      join public.invoices as invoice on invoice.id = reminder.invoice_id
      where invoice.debtor_id = debtor.id
    ), '[]'::jsonb),
    'replies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'invoice_id', reply.invoice_id, 'received_at', reply.received_at, 'kind', reply.kind,
        'excerpt', reply.excerpt, 'ai_classified', reply.ai_classified, 'status', reply.status
      ) order by reply.received_at)
      from public.replies as reply
      join public.invoices as invoice on invoice.id = reply.invoice_id
      where invoice.debtor_id = debtor.id
    ), '[]'::jsonb),
    'promises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'invoice_id', promise.invoice_id, 'promised_amount', promise.promised_amount,
        'promised_date', promise.promised_date, 'source', promise.source, 'kept', promise.kept,
        'created_at', promise.created_at
      ) order by promise.created_at)
      from public.promises as promise
      join public.invoices as invoice on invoice.id = promise.invoice_id
      where invoice.debtor_id = debtor.id
    ), '[]'::jsonb)
  )
  into document
  from public.debtors as debtor
  where debtor.id = p_debtor_id;

  if document is null then
    raise exception 'Débiteur introuvable' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id)
  values (organization, 'user', (select auth.uid()), 'debtor.exported', 'debtor', p_debtor_id);

  return document;
end;
$$;

-- ─── Droits d'exécution ────────────────────────────────────────────────────────

revoke all on function public.record_reply(uuid, uuid, text, timestamptz, public.reply_kind, text, boolean, numeric, date, numeric)
  from public, anon, authenticated;
revoke all on function public.settle_due_promises(uuid) from public, anon, authenticated;
revoke all on function public.resume_reminders(uuid) from public, anon;
revoke all on function public.record_promise(uuid, date, numeric, uuid) from public, anon;
revoke all on function public.resolve_reply(uuid, text, date) from public, anon;

grant execute on function public.record_reply(uuid, uuid, text, timestamptz, public.reply_kind, text, boolean, numeric, date, numeric)
  to service_role;
grant execute on function public.settle_due_promises(uuid) to service_role;
grant execute on function public.resume_reminders(uuid) to authenticated;
grant execute on function public.record_promise(uuid, date, numeric, uuid) to authenticated;
grant execute on function public.resolve_reply(uuid, text, date) to authenticated;
