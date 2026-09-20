-- Relia — réponses des clients : corrections de la revue du palier 11 (CLAUDE.md §5.6, §2.3).
--
-- Migration distincte : 20260919090000_replies.sql a déjà été appliquée sur le projet de développement.
--
-- 1. Une promesse lue dans une réponse n'est appliquée d'office qu'avec une confiance suffisante, et
--    jamais après une promesse rompue sur la même facture (pas de report sans fin) ; la réponse reste
--    « à traiter » pour qu'un membre voie ce que Relia en a déduit. Horizon aligné sur l'application.
-- 2. Aucune relance préparée ni validée pour une facture en pause ou sortie du cycle (garde en base,
--    qui attend la fin d'une réponse en cours d'enregistrement).
-- 3. Ordre de verrouillage unique (facture, puis relance ou réponse) : pas d'interblocage entre une
--    décision d'un membre, une validation de relance et une réponse reçue au même moment.
-- 4. « Corriger la promesse » remplace la promesse détectée au lieu de s'y ajouter.

-- Promesse détectée dans une réponse : au plus 120 jours après réception (MAX_PROMISE_HORIZON_DAYS,
-- lib/replies/promise-date.ts), et appliquée d'office seulement avec une confiance suffisante.
create function private.max_promise_horizon_days() returns integer
language sql
immutable
set search_path = ''
as $$
  select 120
$$;

create function private.auto_promise_min_confidence() returns numeric
language sql
immutable
set search_path = ''
as $$
  select 0.6
$$;

-- Une relance ne se prépare ni ne se valide pour une facture en pause ou sortie du cycle de relance.
-- La facture est lue « for share » : si une réponse est en train d'être enregistrée (verrou de la
-- facture), on attend sa fin et on relit l'état à jour — la préparation ne peut pas passer entre deux.
create function private.guard_reminder_invoice() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice public.invoices%rowtype;
begin
  if new.status not in ('scheduled', 'awaiting_approval') then
    return new;
  end if;
  select * into invoice from public.invoices where id = new.invoice_id for share;
  if invoice.reminders_paused_at is not null then
    raise exception 'Relances suspendues pour cette facture : le client a répondu' using errcode = '23514';
  end if;
  if invoice.status not in ('pending', 'late') then
    raise exception 'Cette facture n''est plus à relancer' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger reminders_guard_invoice
  before insert or update of status on public.reminders
  for each row execute function private.guard_reminder_invoice();

-- Factures sous promesse, parcourues chaque matin pour solder les promesses échues.
create index invoices_promised_idx on public.invoices (organization_id) where status = 'promised';

-- Validation d'une relance (voir la migration « reminders ») : la facture est verrouillée avant la
-- relance, dans le même ordre que l'enregistrement d'une réponse, pour que les deux ne s'interbloquent pas.
create or replace function public.approve_reminder(p_reminder_id uuid, p_subject text default null, p_body text default null)
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
  perform 1 from public.invoices
  where id = (select invoice_id from public.reminders where id = p_reminder_id and organization_id = organization)
  for share;
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

-- Réponse lue dans la boîte du client, rattachée à la relance envoyée. Renvoie null si elle est déjà
-- enregistrée (lectures qui se chevauchent). Une promesse datée est appliquée d'office si la confiance
-- est suffisante et qu'aucune promesse de la facture n'a déjà été rompue (sinon un membre décide) ;
-- toute autre vraie réponse suspend les relances de la facture ; un message d'absence est classé sans
-- effet. Toute vraie réponse reste « à traiter » : un membre voit ce que Relia en a déduit.
create or replace function public.record_reply(
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
  if p_promised_date is not null
    and (p_kind <> 'promise' or p_promised_date not between received_on and received_on + private.max_promise_horizon_days())
  then
    raise exception 'Date de promesse invalide' using errcode = '22023';
  end if;

  -- Verrou de la facture : une réponse et un changement de statut simultanés ne se croisent pas.
  select * into invoice from public.invoices where id = reminder.invoice_id for update;
  if p_promised_amount is not null and (p_promised_amount <= 0 or p_promised_amount > invoice.amount_ttc) then
    raise exception 'Montant promis invalide' using errcode = '22023';
  end if;

  is_open := invoice.status in ('pending', 'late', 'promised');
  -- Une promesse déjà rompue : la suivante n'est plus acceptée d'office (pas de report sans fin).
  applies_promise := p_kind = 'promise' and p_promised_date is not null and is_open
    and coalesce(p_confidence, 0) >= private.auto_promise_min_confidence()
    and not exists (select 1 from public.promises where invoice_id = invoice.id and kept = false);
  pauses := p_kind <> 'auto_reply' and not applies_promise and is_open;

  insert into public.replies (
    organization_id, invoice_id, reminder_id, provider_message_id, received_at, kind, excerpt,
    ai_classified, confidence, status, handled_at
  )
  values (
    p_organization_id, invoice.id, reminder.id, p_provider_message_id, p_received_at, p_kind,
    case when p_kind <> 'auto_reply' then left(nullif(btrim(p_excerpt), ''), 500) end,
    p_ai_classified, p_confidence,
    case when p_kind = 'auto_reply' then 'handled'::public.reply_status else 'new'::public.reply_status end,
    case when p_kind = 'auto_reply' then now() end
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

-- Promesse notée par un membre (appel, courrier, ou réponse dont la date n'a pas été lue). Depuis une
-- réponse dont Relia avait déjà tiré une promesse, c'est une correction : la promesse détectée est remplacée.
create or replace function public.record_promise(
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

  if p_reply_id is not null then
    delete from public.promises where reply_id = p_reply_id and source = 'email_reply' and kept is null;
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
create or replace function public.resolve_reply(p_reply_id uuid, p_resolution text, p_paid_at date default null)
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
  select * into reply from public.replies where id = p_reply_id and organization_id = organization;
  if not found then
    raise exception 'Réponse introuvable' using errcode = 'P0002';
  end if;
  -- Facture puis réponse : même ordre de verrouillage que les changements de statut et les réponses
  -- reçues (sinon deux décisions simultanées sur la même facture pourraient s'interbloquer).
  perform 1 from public.invoices where id = reply.invoice_id for update;
  select * into reply from public.replies where id = p_reply_id for update;
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
