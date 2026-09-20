-- Relia — factures (palier 6, CLAUDE.md §2.2 et §5.2).
--
-- 1. Journal d'audit tenu par la base : création et modification des factures et des débiteurs
--    sont tracées quel que soit le chemin (interface, import, synchronisation, cron).
-- 2. Une facture réglée, contestée, annulée ou sous promesse n'est plus relancée : ses relances
--    en attente sont annulées dans la même transaction.
-- 3. Import en lot (CSV, saisie, Factur-X) : une seule transaction, débiteurs rapprochés ou créés.

-- ─── Journal d'audit automatique ───────────────────────────────────────────────

create function private.audit_invoice_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user uuid := (select auth.uid());
  actor public.actor_type := case when acting_user is null then 'system' else 'user' end;
  cancelled_count integer := 0;
  changed_fields text[];
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
    values (new.organization_id, actor, acting_user, 'invoice.created', 'invoice', new.id,
      jsonb_build_object('number', new.number, 'source', new.source, 'status', new.status, 'amount_ttc', new.amount_ttc));
    return null;
  end if;

  if new.status is distinct from old.status then
    if new.status in ('paid', 'disputed', 'cancelled', 'promised') then
      update public.reminders
      set status = 'cancelled'
      where invoice_id = new.id
        and organization_id = new.organization_id
        and status in ('scheduled', 'awaiting_approval');
      get diagnostics cancelled_count = row_count;
    end if;

    insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
    values (new.organization_id, actor, acting_user, 'invoice.status_changed', 'invoice', new.id,
      jsonb_build_object('from', old.status, 'to', new.status, 'paid_at', new.paid_at,
        'reminders_cancelled', cancelled_count));
  end if;

  select coalesce(array_agg(change.field order by change.field), '{}') into changed_fields
  from (values
    ('number', new.number is distinct from old.number),
    ('debtor_id', new.debtor_id is distinct from old.debtor_id),
    ('amount_ht', new.amount_ht is distinct from old.amount_ht),
    ('amount_ttc', new.amount_ttc is distinct from old.amount_ttc),
    ('currency', new.currency is distinct from old.currency),
    ('issued_at', new.issued_at is distinct from old.issued_at),
    ('due_at', new.due_at is distinct from old.due_at),
    ('paid_at', new.paid_at is distinct from old.paid_at and new.status is not distinct from old.status)
  ) as change (field, is_changed)
  where change.is_changed;

  if cardinality(changed_fields) > 0 then
    insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
    values (new.organization_id, actor, acting_user, 'invoice.updated', 'invoice', new.id,
      jsonb_build_object('fields', to_jsonb(changed_fields)));
  end if;

  return null;
end;
$$;

create trigger invoices_audit
  after insert or update on public.invoices
  for each row execute function private.audit_invoice_change();

-- Débiteurs : pas de nom ni de coordonnées dans le journal (données personnelles), l'identifiant suffit.
create function private.audit_debtor_change() returns trigger
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
    ('risk_score', new.risk_score is distinct from old.risk_score)
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

create trigger debtors_audit
  after insert or update on public.debtors
  for each row execute function private.audit_debtor_change();

-- ─── Statut effectif ───────────────────────────────────────────────────────────

-- Une facture en attente dont l'échéance (heure de Paris) est passée est en retard, même avant
-- le passage du calcul quotidien. Même règle que lib/invoices/dates.ts (effectiveStatus).
create function private.effective_invoice_status(p_status public.invoice_status, p_due_at date)
returns public.invoice_status
language sql
stable
set search_path = ''
as $$
  select case
    when p_status = 'pending' and p_due_at < (now() at time zone 'Europe/Paris')::date then 'late'::public.invoice_status
    else p_status
  end
$$;

grant execute on function private.effective_invoice_status(public.invoice_status, date) to authenticated;

-- Motif « contient » pour LIKE, jokers de la saisie échappés : « 100% » ne veut pas dire « tout ».
create function private.contains_pattern(p_text text) returns text
language sql
immutable
set search_path = ''
as $$
  select '%' || replace(replace(replace(coalesce(p_text, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%'
$$;

grant execute on function private.contains_pattern(text) to authenticated;

-- ─── Import en lot ─────────────────────────────────────────────────────────────

-- Rapprochement des débiteurs à l'import (par SIREN, puis par nom).
create index debtors_organization_siren_idx on public.debtors (organization_id, siren) where siren is not null;
create index debtors_organization_name_idx on public.debtors (organization_id, lower(btrim(name)));

create type private.invoice_import_row as (
  number text,
  debtor_name text,
  debtor_siren text,
  debtor_email text,
  client_type public.client_type,
  amount_ht numeric(14, 2),
  amount_ttc numeric(14, 2),
  currency text,
  issued_at date,
  due_at date,
  paid_at date,
  external_id text,
  factur_x_raw jsonb
);

-- Exécutée avec les droits de l'utilisateur : la RLS s'applique à chaque ligne créée.
-- Rapprochement des débiteurs : par SIREN, sinon par nom (sans tenir compte de la casse) quand les
-- e-mails ne se contredisent pas — deux homonymes aux e-mails différents sont deux personnes ;
-- le type de client d'un débiteur existant prévaut. Les numéros déjà présents sont ignorés.
create function public.import_invoices(p_rows jsonb, p_source public.invoice_source)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  organization uuid := (select private.current_organization_id());
  result jsonb;
begin
  if organization is null then
    raise exception 'Aucune organisation pour cet utilisateur' using errcode = '42501';
  end if;
  -- Les sources des intégrations sont réservées à la synchronisation côté serveur.
  if p_source not in ('manual', 'csv', 'facturx') then
    raise exception 'Source d''import non autorisée : %', p_source using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 2000 then
    raise exception 'Un import compte entre 1 et 2000 factures' using errcode = '22023';
  end if;

  -- Deux imports simultanés d'une même organisation se suivent : ni débiteur ni numéro en double.
  perform pg_advisory_xact_lock(hashtextextended('relia.import_invoices:' || organization::text, 0));

  with incoming as (
    select
      entry.row_index,
      btrim(item.number) as invoice_number,
      btrim(item.debtor_name) as debtor_name,
      nullif(btrim(item.debtor_siren), '') as debtor_siren,
      nullif(btrim(item.debtor_email), '') as debtor_email,
      item.client_type,
      item.amount_ht,
      item.amount_ttc,
      coalesce(nullif(upper(btrim(item.currency)), ''), 'EUR') as currency,
      item.issued_at,
      item.due_at,
      item.paid_at,
      nullif(btrim(item.external_id), '') as external_id,
      item.factur_x_raw
    from jsonb_array_elements(p_rows) with ordinality as entry (value, row_index)
    cross join lateral jsonb_populate_record(null::private.invoice_import_row, entry.value) as item
  ),
  -- Dans un même fichier, une ligne sans SIREN reprend celui des autres lignes du même client
  -- (s'il est unique) : une saisie incomplète ne crée pas deux fiches pour une entreprise.
  identified as (
    select
      incoming.*,
      coalesce(
        incoming.debtor_siren,
        case
          when min(incoming.debtor_siren) over same_name = max(incoming.debtor_siren) over same_name
            then min(incoming.debtor_siren) over same_name
        end
      ) as known_siren
    from incoming
    window same_name as (partition by lower(incoming.debtor_name))
  ),
  fresh as (
    select distinct on (identified.invoice_number) identified.*
    from identified
    where not exists (
      select 1 from public.invoices as invoice
      where invoice.organization_id = organization and invoice.number = identified.invoice_number
    )
    order by identified.invoice_number, identified.row_index
  ),
  matched as (
    select
      fresh.*,
      coalesce(
        (select debtor.id from public.debtors as debtor
          where debtor.organization_id = organization
            and fresh.known_siren is not null and debtor.siren = fresh.known_siren
          order by debtor.created_at limit 1),
        (select debtor.id from public.debtors as debtor
          where debtor.organization_id = organization
            and lower(btrim(debtor.name)) = lower(fresh.debtor_name)
            and (debtor.siren is null or fresh.known_siren is null)
            and (
              debtor.contact_email is null or fresh.debtor_email is null
              or lower(debtor.contact_email) = lower(fresh.debtor_email)
            )
          order by debtor.created_at limit 1)
      ) as debtor_id,
      coalesce(
        'siren:' || fresh.known_siren,
        'name:' || lower(fresh.debtor_name) || '|' || coalesce(lower(fresh.debtor_email), '')
      ) as debtor_key
    from fresh
  ),
  new_debtors as (
    insert into public.debtors (organization_id, name, siren, client_type, contact_email)
    select distinct on (matched.debtor_key)
      organization, matched.debtor_name, matched.known_siren, matched.client_type, matched.debtor_email
    from matched
    where matched.debtor_id is null
    order by matched.debtor_key, matched.row_index
    returning id, coalesce('siren:' || siren, 'name:' || lower(name) || '|' || coalesce(lower(contact_email), '')) as debtor_key
  ),
  inserted as (
    insert into public.invoices (
      organization_id, debtor_id, number, amount_ht, amount_ttc, currency,
      issued_at, due_at, paid_at, status, source, external_id, factur_x_raw
    )
    select
      organization,
      coalesce(matched.debtor_id, new_debtors.id),
      matched.invoice_number,
      matched.amount_ht,
      matched.amount_ttc,
      matched.currency,
      matched.issued_at,
      matched.due_at,
      matched.paid_at,
      case
        when matched.paid_at is not null then 'paid'::public.invoice_status
        else private.effective_invoice_status('pending', matched.due_at)
      end,
      p_source,
      matched.external_id,
      matched.factur_x_raw
    from matched
    left join new_debtors on matched.debtor_id is null and new_debtors.debtor_key = matched.debtor_key
    order by matched.row_index
    returning id
  )
  select jsonb_build_object(
    'created', (select count(*) from inserted),
    'invoice_ids', (select coalesce(jsonb_agg(inserted.id), '[]'::jsonb) from inserted),
    'debtors_created', (select count(*) from new_debtors),
    'skipped', (
      select coalesce(jsonb_agg(incoming.invoice_number order by incoming.row_index), '[]'::jsonb)
      from incoming
      where not exists (select 1 from fresh where fresh.row_index = incoming.row_index)
    )
  ) into result;

  -- Chaque facture créée est déjà tracée (invoice.created) ; l'import lui-même l'est aussi.
  if p_source <> 'manual' then
    insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, payload)
    values (organization, 'user', (select auth.uid()), 'invoices.imported', 'invoice',
      jsonb_build_object(
        'source', p_source,
        'created', result -> 'created',
        'skipped', jsonb_array_length(result -> 'skipped'),
        'debtors_created', result -> 'debtors_created'
      ));
  end if;

  return result;
end;
$$;

revoke all on function public.import_invoices(jsonb, public.invoice_source) from public, anon;
grant execute on function public.import_invoices(jsonb, public.invoice_source) to authenticated;

-- ─── Lecture : liste et comptes ────────────────────────────────────────────────

create function public.invoice_status_counts()
returns table (status public.invoice_status, invoice_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select private.effective_invoice_status(invoice.status, invoice.due_at), count(*)::integer
  from public.invoices as invoice
  group by 1
$$;

-- Liste paginée : filtre sur le statut effectif, recherche dans le numéro et le nom du client.
-- p_sort : due_asc (à encaisser : la plus ancienne échéance d'abord), paid_desc, issued_desc.
create function public.list_invoices(
  p_statuses public.invoice_status[] default null,
  p_search text default '',
  p_sort text default 'due_asc',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  number text,
  debtor_id uuid,
  debtor_name text,
  client_type public.client_type,
  amount_ttc numeric,
  currency text,
  issued_at date,
  due_at date,
  paid_at date,
  status public.invoice_status,
  total_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with listed as (
    select
      invoice.id, invoice.number, invoice.debtor_id, debtor.name as debtor_name, debtor.client_type,
      invoice.amount_ttc, invoice.currency::text as currency, invoice.issued_at, invoice.due_at, invoice.paid_at,
      private.effective_invoice_status(invoice.status, invoice.due_at) as status
    from public.invoices as invoice
    join public.debtors as debtor on debtor.id = invoice.debtor_id
  )
  select listed.*, (count(*) over ())::integer
  from listed
  where (p_statuses is null or listed.status = any (p_statuses))
    and (
      coalesce(p_search, '') = ''
      or listed.number ilike private.contains_pattern(p_search)
      or listed.debtor_name ilike private.contains_pattern(p_search)
    )
  order by
    case when p_sort = 'due_asc' then listed.due_at end asc,
    case when p_sort = 'paid_desc' then listed.paid_at end desc nulls last,
    case when p_sort = 'issued_desc' then listed.issued_at end desc,
    listed.number
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0)
$$;

revoke all on function public.invoice_status_counts() from public, anon;
revoke all on function public.list_invoices(public.invoice_status[], text, text, integer, integer) from public, anon;
grant execute on function public.invoice_status_counts() to authenticated;
grant execute on function public.list_invoices(public.invoice_status[], text, text, integer, integer) to authenticated;

-- ─── Changements de statut ─────────────────────────────────────────────────────
-- Un membre ne modifie ni ne supprime une facture directement : le statut passe par cette
-- fonction, qui applique les transitions de lib/invoices/transitions.ts (parité testée) et
-- verrouille la ligne (deux changements simultanés ne s'écrasent pas).
revoke update, delete on public.invoices from authenticated;

create function public.change_invoice_status(p_invoice_id uuid, p_action text, p_paid_at date default null)
returns public.invoice_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization uuid := (select private.current_organization_id());
  paris_today date := (now() at time zone 'Europe/Paris')::date;
  current_status public.invoice_status;
  current_due_at date;
  allowed public.invoice_status[];
  next_status public.invoice_status;
begin
  if organization is null then
    raise exception 'Aucune organisation pour cet utilisateur' using errcode = '42501';
  end if;

  select invoice.status, invoice.due_at into current_status, current_due_at
  from public.invoices as invoice
  where invoice.id = p_invoice_id and invoice.organization_id = organization
  for update;
  if not found then
    raise exception 'Facture introuvable' using errcode = 'P0002';
  end if;

  allowed := case p_action
    when 'mark_paid' then array['pending', 'late', 'promised', 'disputed']::public.invoice_status[]
    when 'mark_disputed' then array['pending', 'late', 'promised']::public.invoice_status[]
    when 'cancel' then array['pending', 'late', 'promised', 'disputed']::public.invoice_status[]
    when 'reopen' then array['paid', 'disputed', 'cancelled']::public.invoice_status[]
  end;
  if allowed is null then
    raise exception 'Action inconnue : %', p_action using errcode = '22023';
  end if;
  if not (current_status = any (allowed)) then
    raise exception 'Action impossible depuis le statut %', current_status using errcode = '22023';
  end if;
  if p_action = 'mark_paid' and (p_paid_at is null or p_paid_at > paris_today) then
    raise exception 'Date de règlement manquante ou dans le futur' using errcode = '22023';
  end if;

  next_status := case p_action
    when 'mark_paid' then 'paid'::public.invoice_status
    when 'mark_disputed' then 'disputed'::public.invoice_status
    when 'cancel' then 'cancelled'::public.invoice_status
    else private.effective_invoice_status('pending', current_due_at)
  end;

  update public.invoices
  set status = next_status, paid_at = case when p_action = 'mark_paid' then p_paid_at end
  where id = p_invoice_id;

  return next_status;
end;
$$;

revoke all on function public.change_invoice_status(uuid, text, date) from public, anon;
grant execute on function public.change_invoice_status(uuid, text, date) to authenticated;
