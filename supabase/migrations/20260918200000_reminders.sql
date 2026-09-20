-- Relia — moteur de relance (palier 10, CLAUDE.md §2.3, §2.6 et §5.4-5.5).
--
-- Les relances sont gérées par le serveur : planification et envoi avec la clé de service (crons,
-- actions), validation et annulation par les membres au travers de fonctions dédiées. Un membre
-- ne crée ni ne modifie une relance directement.
--
-- §2.3 : une relance rédigée par IA ne part qu'après une validation humaine, pour le premier envoi
-- à un débiteur donné. Ensuite seulement, l'envoi automatique peut être activé par le client.

-- ─── Réglage de l'organisation ─────────────────────────────────────────────────

-- Envoi automatique des relances préparées (désactivé : chaque relance est validée à la main).
alter table public.organizations add column auto_send boolean not null default false;
grant update (auto_send) on public.organizations to authenticated;

-- ─── Relances : écriture réservée au serveur ───────────────────────────────────

revoke insert, update, delete on public.reminders from authenticated;

-- Une étape n'a qu'une relance active par facture (une relance en échec ou annulée peut être refaite).
create unique index reminders_active_step_key on public.reminders (invoice_id, step_id)
  where step_id is not null and status in ('scheduled', 'awaiting_approval', 'sent');

-- Réservation par l'envoi (cron) : deux passages simultanés n'envoient pas deux fois.
alter table public.reminders add column claimed_at timestamptz;
-- Conversation chez le fournisseur (fil Gmail, conversation Outlook) : rattache les réponses (palier 11).
alter table public.reminders add column provider_thread_id text;

-- ─── §2.3 : validation humaine avant le premier envoi IA à un débiteur ────────

create function private.debtor_has_approved_ai_reminder(p_invoice_id uuid, p_excluded_reminder uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reminders as reminder
    join public.invoices as invoice on invoice.id = reminder.invoice_id
    where invoice.debtor_id = (select debtor_id from public.invoices where id = p_invoice_id)
      and reminder.id <> p_excluded_reminder
      and reminder.ai_generated
      and reminder.approved_by is not null
  )
$$;

create function private.guard_first_ai_send() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ai_generated
    and new.status in ('scheduled', 'sent')
    and new.approved_by is null
    and not private.debtor_has_approved_ai_reminder(new.invoice_id, new.id)
  then
    raise exception 'Première relance rédigée par IA pour ce débiteur : une validation humaine est nécessaire'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger reminders_guard_first_ai_send
  before insert or update of status, approved_by on public.reminders
  for each row execute function private.guard_first_ai_send();

-- §2.5 et §2.6 : le texte d'une relance obéit aux mêmes règles que les modèles, selon le débiteur.
create function private.check_reminder_content() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  debtor_client_type public.client_type;
  violations text[];
begin
  if new.subject is null and new.body is null then
    return new;
  end if;
  select debtor.client_type into debtor_client_type
  from public.invoices as invoice
  join public.debtors as debtor on debtor.id = invoice.debtor_id
  where invoice.id = new.invoice_id;

  violations := private.template_violations(debtor_client_type, new.subject, new.body);
  if cardinality(violations) > 0 then
    raise exception 'Relance refusée : %', array_to_string(violations, ', ') using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger reminders_check_content
  before insert or update of subject, body on public.reminders
  for each row execute function private.check_reminder_content();

-- ─── Validation et annulation par un membre ────────────────────────────────────

-- Valide une relance en attente (texte éventuellement retouché) : elle part à l'heure prévue, ou
-- tout de suite si cette heure est passée. L'approbation est signée par le membre connecté.
create function public.approve_reminder(p_reminder_id uuid, p_subject text default null, p_body text default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization uuid := (select private.current_organization_id());
  acting_user uuid := (select auth.uid());
  reminder public.reminders%rowtype;
  send_at timestamptz;
begin
  if organization is null or acting_user is null then
    raise exception 'Aucune organisation pour cet utilisateur' using errcode = '42501';
  end if;
  select * into reminder from public.reminders
  where id = p_reminder_id and organization_id = organization
  for update;
  if not found then
    raise exception 'Relance introuvable' using errcode = 'P0002';
  end if;
  if reminder.status <> 'awaiting_approval' then
    raise exception 'Cette relance n''attend plus de validation' using errcode = '22023';
  end if;

  send_at := greatest(reminder.scheduled_at, now());
  update public.reminders
  set subject = coalesce(nullif(btrim(p_subject), ''), subject),
      body = coalesce(nullif(btrim(p_body), ''), body),
      approved_by = acting_user,
      status = 'scheduled',
      scheduled_at = send_at,
      claimed_at = null
  where id = p_reminder_id;

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (organization, 'user', acting_user, 'reminder.approved', 'reminder', p_reminder_id,
    jsonb_build_object('invoice_id', reminder.invoice_id, 'edited', p_subject is not null or p_body is not null));

  return send_at;
end;
$$;

create function public.cancel_reminder(p_reminder_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization uuid := (select private.current_organization_id());
  reminder public.reminders%rowtype;
begin
  if organization is null then
    raise exception 'Aucune organisation pour cet utilisateur' using errcode = '42501';
  end if;
  select * into reminder from public.reminders
  where id = p_reminder_id and organization_id = organization
  for update;
  if not found then
    raise exception 'Relance introuvable' using errcode = 'P0002';
  end if;
  if reminder.status not in ('scheduled', 'awaiting_approval') then
    raise exception 'Cette relance ne peut plus être annulée' using errcode = '22023';
  end if;

  update public.reminders set status = 'cancelled' where id = p_reminder_id;
  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (organization, 'user', (select auth.uid()), 'reminder.cancelled', 'reminder', p_reminder_id,
    jsonb_build_object('invoice_id', reminder.invoice_id));
end;
$$;

-- ─── Envoi (clé de service) ────────────────────────────────────────────────────

-- Réserve les relances dues : une relance réservée depuis moins de 10 minutes n'est pas reprise.
create function public.claim_due_reminders(p_limit integer) returns setof public.reminders
language sql
security definer
set search_path = ''
as $$
  update public.reminders
  set claimed_at = now()
  where id in (
    select candidate.id from public.reminders as candidate
    where candidate.status = 'scheduled'
      and candidate.scheduled_at <= now()
      and (candidate.claimed_at is null or candidate.claimed_at < now() - interval '10 minutes')
    order by candidate.scheduled_at
    limit least(greatest(p_limit, 1), 200)
    for update skip locked
  )
  returning *
$$;

-- Réserve une relance précise, validée à l'instant par un membre (« valider et envoyer »).
create function public.claim_reminder(p_reminder_id uuid) returns setof public.reminders
language sql
security definer
set search_path = ''
as $$
  update public.reminders
  set claimed_at = now()
  where id = (
    select candidate.id from public.reminders as candidate
    where candidate.id = p_reminder_id
      and candidate.status = 'scheduled'
      and candidate.scheduled_at <= now()
      and (candidate.claimed_at is null or candidate.claimed_at < now() - interval '10 minutes')
    for update skip locked
  )
  returning *
$$;

-- Résultat d'un envoi : envoyée (identifiant du fournisseur) ou en échec (motif), tracé au nom du système.
-- Une relance annulée pendant son envoi (facture réglée à cet instant) est quand même notée envoyée :
-- le message est parti, l'historique doit le dire.
create function public.record_reminder_result(
  p_reminder_id uuid,
  p_is_sent boolean,
  p_provider_message_id text default null,
  p_error text default null,
  p_provider_thread_id text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reminder public.reminders%rowtype;
begin
  select * into reminder from public.reminders where id = p_reminder_id for update;
  if not found
    or not (reminder.status = 'scheduled' or (p_is_sent and reminder.status = 'cancelled' and reminder.claimed_at is not null))
  then
    raise exception 'Relance introuvable ou déjà traitée' using errcode = 'P0002';
  end if;

  update public.reminders
  set status = case when p_is_sent then 'sent'::public.reminder_status else 'failed'::public.reminder_status end,
      sent_at = case when p_is_sent then now() end,
      provider_message_id = p_provider_message_id,
      provider_thread_id = p_provider_thread_id,
      error = case when p_is_sent then null else left(p_error, 500) end,
      claimed_at = null
  where id = p_reminder_id;

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (reminder.organization_id, 'system', null,
    case when p_is_sent then 'reminder.sent' else 'reminder.failed' end, 'reminder', p_reminder_id,
    jsonb_build_object('invoice_id', reminder.invoice_id)
      || case when reminder.status = 'cancelled' then jsonb_build_object('after_cancel', true) else '{}'::jsonb end);
end;
$$;

revoke all on function public.approve_reminder(uuid, text, text) from public, anon;
revoke all on function public.cancel_reminder(uuid) from public, anon;
revoke all on function public.claim_due_reminders(integer) from public, anon, authenticated;
revoke all on function public.record_reminder_result(uuid, boolean, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_reminder(uuid) from public, anon, authenticated;
grant execute on function public.approve_reminder(uuid, text, text) to authenticated;
grant execute on function public.cancel_reminder(uuid) to authenticated;
grant execute on function public.claim_due_reminders(integer) to service_role;
grant execute on function public.record_reminder_result(uuid, boolean, text, text, text) to service_role;
grant execute on function public.claim_reminder(uuid) to service_role;
