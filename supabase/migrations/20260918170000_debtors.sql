-- Relia — débiteurs (palier 7, CLAUDE.md §2.2, §2.4 et §2.5).
--
-- 1. Comportement de paiement et score de risque de retard, calculés par la base à partir des
--    factures de l'organisation. Score réservé aux personnes morales (§2.4) : ni particulier,
--    ni entrepreneur individuel. Colonnes réservées au serveur : un membre ne peut pas les écrire.
-- 2. Suppression d'un débiteur réservée aux responsables (owner, admin).
-- 3. Liste avec encours, export et effacement des données d'un débiteur (droits d'accès et
--    d'effacement que le client doit pouvoir honorer, §2.2).

-- ─── Colonnes calculées : réservées au serveur ─────────────────────────────────

revoke insert, update on public.debtors from authenticated;
grant insert (organization_id, name, siren, is_legal_entity, client_type, contact_email, contact_name, phone, address, notes)
  on public.debtors to authenticated;
grant update (name, siren, is_legal_entity, client_type, contact_email, contact_name, phone, address, notes)
  on public.debtors to authenticated;

-- ─── Suppression réservée aux responsables ─────────────────────────────────────

drop policy "Membres : données de leur organisation" on public.debtors;

create policy "Membres : lecture des débiteurs de leur organisation"
  on public.debtors for select to authenticated
  using (organization_id = (select private.current_organization_id()));

create policy "Membres : ajout de débiteurs à leur organisation"
  on public.debtors for insert to authenticated
  with check (organization_id = (select private.current_organization_id()));

create policy "Membres : modification des débiteurs de leur organisation"
  on public.debtors for update to authenticated
  using (organization_id = (select private.current_organization_id()))
  with check (organization_id = (select private.current_organization_id()));

create policy "Responsables : suppression des débiteurs de leur organisation"
  on public.debtors for delete to authenticated
  using (
    organization_id = (select private.current_organization_id())
    and (select private.current_member_role()) in ('owner', 'admin')
  );

-- ─── Comportement de paiement et score de risque ───────────────────────────────

-- §2.4 : score seulement pour une personne morale identifiée (B2B, SIREN, forme juridique).
-- Même règle que lib/debtors/scoring.ts (isScoringEligible).
create function private.is_scoring_eligible(p_client_type public.client_type, p_siren text, p_is_legal_entity boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_client_type = 'b2b' and p_siren is not null and coalesce(p_is_legal_entity, false)
$$;

-- Historique pris en compte : factures échues depuis deux ans au plus.
create function private.scoring_window_start() returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Paris')::date - 730
$$;

-- Retard moyen de règlement, en jours (négatif : le client règle en avance) ; null sans facture réglée.
create function private.debtor_payment_behavior_days(p_debtor_id uuid) returns integer
language sql
stable
set search_path = ''
as $$
  select round(avg(invoice.paid_at - invoice.due_at))::integer
  from public.invoices as invoice
  where invoice.debtor_id = p_debtor_id
    and invoice.status = 'paid'
    and invoice.paid_at is not null
    and invoice.due_at >= private.scoring_window_start()
$$;

-- Score de risque de retard (0 à 100), sur le seul historique de l'organisation avec ce débiteur :
--   40 points : retard moyen des factures réglées (plein à 60 jours)
--   30 points : part des factures réglées en retard
--   30 points : plus ancien retard en cours (plein à 90 jours)
-- Null sans historique (ni facture réglée, ni facture échue). Pondérations reprises dans lib/debtors/scoring.ts.
create function private.debtor_risk_score(p_debtor_id uuid) returns smallint
language sql
stable
set search_path = ''
as $$
  with paid as (
    select greatest(invoice.paid_at - invoice.due_at, 0) as delay
    from public.invoices as invoice
    where invoice.debtor_id = p_debtor_id
      and invoice.status = 'paid'
      and invoice.paid_at is not null
      and invoice.due_at >= private.scoring_window_start()
  ),
  overdue as (
    select max((now() at time zone 'Europe/Paris')::date - invoice.due_at) as days
    from public.invoices as invoice
    where invoice.debtor_id = p_debtor_id
      and invoice.status in ('pending', 'late', 'promised')
      and invoice.due_at < (now() at time zone 'Europe/Paris')::date
  )
  select case
    when not exists (select 1 from paid) and (select days from overdue) is null then null
    else round(
      40 * least(coalesce((select avg(delay) from paid), 0) / 60.0, 1)
      + 30 * coalesce((select avg((delay > 0)::integer) from paid), 0)
      + 30 * least(coalesce((select days from overdue), 0) / 90.0, 1)
    )::smallint
  end
$$;

create function private.refresh_debtor_payment_stats(p_debtor_ids uuid[]) returns void
language sql
security definer
set search_path = ''
as $$
  update public.debtors as debtor
  set
    payment_behavior_days = private.debtor_payment_behavior_days(debtor.id),
    risk_score = case
      when private.is_scoring_eligible(debtor.client_type, debtor.siren, debtor.is_legal_entity)
        then private.debtor_risk_score(debtor.id)
    end
  where debtor.id = any (p_debtor_ids)
$$;

-- Recalcul après toute écriture sur les factures, une fois par instruction (un import de
-- 2 000 factures ne recalcule chaque débiteur qu'une fois).
create function private.refresh_stats_after_invoice_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  debtor_ids uuid[];
begin
  if tg_op = 'INSERT' then
    select array_agg(distinct changed.debtor_id) into debtor_ids from new_rows as changed;
  elsif tg_op = 'UPDATE' then
    select array_agg(distinct changed.debtor_id) into debtor_ids
    from (select debtor_id from new_rows union select debtor_id from old_rows) as changed;
  else
    select array_agg(distinct changed.debtor_id) into debtor_ids from old_rows as changed;
  end if;

  if debtor_ids is not null then
    perform private.refresh_debtor_payment_stats(debtor_ids);
  end if;
  return null;
end;
$$;

create trigger invoices_refresh_stats_insert
  after insert on public.invoices
  referencing new table as new_rows
  for each statement execute function private.refresh_stats_after_invoice_change();

create trigger invoices_refresh_stats_update
  after update on public.invoices
  referencing old table as old_rows new table as new_rows
  for each statement execute function private.refresh_stats_after_invoice_change();

create trigger invoices_refresh_stats_delete
  after delete on public.invoices
  referencing old table as old_rows
  for each statement execute function private.refresh_stats_after_invoice_change();

-- Un débiteur qui cesse d'être une personne morale identifiée perd son score dans la même
-- écriture (sinon la contrainte debtors_risk_score_legal_entities_only la refuserait) ; celui
-- qui le devient est noté aussitôt.
create function private.rescore_debtor() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.risk_score := case
    when private.is_scoring_eligible(new.client_type, new.siren, new.is_legal_entity)
      then private.debtor_risk_score(new.id)
  end;
  return new;
end;
$$;

create trigger debtors_rescore
  before update of client_type, siren, is_legal_entity on public.debtors
  for each row execute function private.rescore_debtor();

-- Journal : les colonnes calculées (score, comportement) ne sont pas des modifications du client.
create or replace function private.audit_debtor_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user uuid := (select auth.uid());
  actor public.actor_type := case when acting_user is null then 'system' else 'user' end;
  changed_fields text[];
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
    values (new.organization_id, actor, acting_user, 'debtor.created', 'debtor', new.id,
      jsonb_build_object('client_type', new.client_type));
    return null;
  end if;

  select coalesce(array_agg(change.field order by change.field), '{}') into changed_fields
  from (values
    ('name', new.name is distinct from old.name),
    ('siren', new.siren is distinct from old.siren),
    ('is_legal_entity', new.is_legal_entity is distinct from old.is_legal_entity),
    ('client_type', new.client_type is distinct from old.client_type),
    ('contact_email', new.contact_email is distinct from old.contact_email),
    ('contact_name', new.contact_name is distinct from old.contact_name),
    ('phone', new.phone is distinct from old.phone),
    ('address', new.address is distinct from old.address),
    ('notes', new.notes is distinct from old.notes)
  ) as change (field, is_changed)
  where change.is_changed;

  if cardinality(changed_fields) > 0 then
    insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
    values (new.organization_id, actor, acting_user, 'debtor.updated', 'debtor', new.id,
      jsonb_build_object('fields', to_jsonb(changed_fields)));
  end if;

  return null;
end;
$$;

-- ─── Liste des débiteurs avec encours ──────────────────────────────────────────
-- Montants en euros seulement : les factures en devise étrangère ne s'additionnent pas.
create function public.list_debtors(
  p_client_type public.client_type default null,
  p_search text default '',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  client_type public.client_type,
  siren text,
  is_legal_entity boolean,
  contact_email text,
  risk_score smallint,
  payment_behavior_days integer,
  invoice_count integer,
  open_amount numeric,
  late_amount numeric,
  total_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with totals as (
    select
      invoice.debtor_id,
      count(*)::integer as invoice_count,
      coalesce(sum(invoice.amount_ttc) filter (
        where invoice.currency = 'EUR' and invoice.status in ('pending', 'late', 'promised')
      ), 0) as open_amount,
      coalesce(sum(invoice.amount_ttc) filter (
        where invoice.currency = 'EUR' and private.effective_invoice_status(invoice.status, invoice.due_at) = 'late'
      ), 0) as late_amount
    from public.invoices as invoice
    group by invoice.debtor_id
  )
  select
    debtor.id, debtor.name, debtor.client_type, debtor.siren, debtor.is_legal_entity, debtor.contact_email,
    debtor.risk_score, debtor.payment_behavior_days,
    coalesce(totals.invoice_count, 0), coalesce(totals.open_amount, 0), coalesce(totals.late_amount, 0),
    (count(*) over ())::integer
  from public.debtors as debtor
  left join totals on totals.debtor_id = debtor.id
  where (p_client_type is null or debtor.client_type = p_client_type)
    and (
      coalesce(p_search, '') = ''
      or debtor.name ilike private.contains_pattern(p_search)
      or debtor.contact_email ilike private.contains_pattern(p_search)
      or debtor.siren like private.contains_pattern(p_search)
    )
  order by coalesce(totals.late_amount, 0) desc, coalesce(totals.open_amount, 0) desc, debtor.name
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0)
$$;

-- ─── Droits des personnes : export et effacement (§2.2) ────────────────────────

-- Toutes les données d'un débiteur détenues par Relia pour l'organisation, en un document.
create function public.export_debtor(p_debtor_id uuid) returns jsonb
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

-- Effacement : le débiteur, ses factures, relances et promesses. Le journal garde la trace de
-- l'effacement sans aucune donnée personnelle. Réservé aux responsables (politique de suppression).
create function public.delete_debtor(p_debtor_id uuid) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  organization uuid := (select private.current_organization_id());
  invoice_count integer;
begin
  select count(*)::integer into invoice_count from public.invoices where debtor_id = p_debtor_id;

  delete from public.debtors where id = p_debtor_id;
  if not found then
    raise exception 'Débiteur introuvable ou suppression non autorisée' using errcode = '42501';
  end if;

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (organization, 'user', (select auth.uid()), 'debtor.deleted', 'debtor', p_debtor_id,
    jsonb_build_object('invoices_deleted', invoice_count));

  return invoice_count;
end;
$$;

revoke all on function public.list_debtors(public.client_type, text, integer, integer) from public, anon;
revoke all on function public.export_debtor(uuid) from public, anon;
revoke all on function public.delete_debtor(uuid) from public, anon;
grant execute on function public.list_debtors(public.client_type, text, integer, integer) to authenticated;
grant execute on function public.export_debtor(uuid) to authenticated;
grant execute on function public.delete_debtor(uuid) to authenticated;
