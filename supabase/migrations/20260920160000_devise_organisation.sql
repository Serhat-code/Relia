-- Relia — devise de travail de l'organisation (ouverture hors zone euro).
--
-- La synthèse du tableau de bord ne sommait que des euros : hors zone euro (leu roumain, couronne
-- tchèque, dinar serbe…), tous les indicateurs tombaient à zéro. On ne convertit toujours rien —
-- additionner des devises reste faux — mais l'organisation déclare la sienne, et la synthèse porte
-- sur celle-là. Les factures des autres devises sont comptées à part, pour que l'écran le dise au
-- lieu de les taire.

alter table public.organizations
  add column default_currency text not null default 'EUR'
    constraint organizations_default_currency_check check (default_currency ~ '^[A-Z]{3}$');

comment on column public.organizations.default_currency is
  'Devise de travail (ISO 4217). La synthèse du tableau de bord ne porte que sur elle.';

-- Même régime que les autres réglages d'organisation : owner et admin seulement, via la RLS.
grant update (default_currency) on public.organizations to authenticated;

-- Devise de travail de l'organisation du membre connecté. `security invoker` : la RLS ne laisse
-- voir que sa propre organisation. L'agrégat garantit une ligne même quand aucune n'est visible
-- (compte orphelin dont le provisionnement a échoué) : sans lui la valeur serait NULL, tous les
-- filtres `= NULL` deviendraient faux, et la clé « currency » sortirait à null — ce que la
-- validation Zod côté application refuse, au lieu d'afficher des totaux à zéro.
create function private.working_currency() returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(min(organization.default_currency), 'EUR') from public.organizations as organization
$$;

create or replace function public.dashboard_summary() returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'Europe/Paris')::date as day
  ),
  working_currency as (
    select private.working_currency() as code
  ),
  open_invoices as (
    select
      invoice.amount_ttc,
      invoice.status,
      private.effective_invoice_status(invoice.status, invoice.due_at) as effective,
      (select day from today) - invoice.due_at as days_late
    from public.invoices as invoice
    where invoice.currency = (select code from working_currency)
      and invoice.status in ('pending', 'late', 'promised')
  ),
  late_invoices as (
    select * from open_invoices where effective = 'late'
  ),
  at_risk as (
    select
      invoice.id, invoice.number, invoice.amount_ttc, invoice.currency, invoice.due_at,
      debtor.id as debtor_id, debtor.name as debtor_name, debtor.risk_score
    from public.invoices as invoice
    join public.debtors as debtor on debtor.id = invoice.debtor_id
    where private.effective_invoice_status(invoice.status, invoice.due_at) = 'late'
    order by invoice.due_at, invoice.amount_ttc desc
    limit 5
  )
  select jsonb_build_object(
    'currency', (select code from working_currency),
    'open_amount', (select coalesce(sum(amount_ttc), 0) from open_invoices),
    'open_count', (select count(*) from open_invoices),
    'late_amount', (select coalesce(sum(amount_ttc), 0) from late_invoices),
    'late_count', (select count(*) from late_invoices),
    'promised_amount', (select coalesce(sum(amount_ttc), 0) from open_invoices where status = 'promised'),
    'promised_count', (select count(*) from open_invoices where status = 'promised'),
    -- Factures en cours dans une autre devise : jamais additionnées, mais jamais passées sous silence.
    'other_currency_count', (
      select count(*)
      from public.invoices as invoice
      where invoice.currency <> (select code from working_currency)
        and invoice.status in ('pending', 'late', 'promised')
    ),
    -- Chiffre d'affaires facturé sur 90 jours (hors factures annulées) : base du DSO.
    'billed_90_days', (
      select coalesce(sum(invoice.amount_ttc), 0)
      from public.invoices as invoice
      where invoice.currency = (select code from working_currency) and invoice.status <> 'cancelled'
        and invoice.issued_at > (select day from today) - 90
    ),
    -- Ancienneté des retards (montants) : 1 à 30 jours, 31 à 60, 61 à 90, plus de 90.
    'aging', jsonb_build_array(
      (select coalesce(sum(amount_ttc), 0) from late_invoices where days_late between 1 and 30),
      (select coalesce(sum(amount_ttc), 0) from late_invoices where days_late between 31 and 60),
      (select coalesce(sum(amount_ttc), 0) from late_invoices where days_late between 61 and 90),
      (select coalesce(sum(amount_ttc), 0) from late_invoices where days_late > 90)
    ),
    -- Les retards les plus anciens, puis les plus élevés (toutes devises : liste, pas somme).
    'at_risk', coalesce((
      select jsonb_agg(to_jsonb(at_risk) order by at_risk.due_at, at_risk.amount_ttc desc) from at_risk
    ), '[]'::jsonb)
  )
$$;

-- Même correction sur la liste des débiteurs : l'encours et le retard de chaque client étaient eux
-- aussi figés à l'euro, donc nuls pour une organisation hors zone euro.
create or replace function public.list_debtors(
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
  with working as (
    select private.working_currency() as code
  ),
  totals as (
    select
      invoice.debtor_id,
      count(*)::integer as invoice_count,
      coalesce(sum(invoice.amount_ttc) filter (
        where invoice.currency = (select code from working) and invoice.status in ('pending', 'late', 'promised')
      ), 0) as open_amount,
      coalesce(sum(invoice.amount_ttc) filter (
        where invoice.currency = (select code from working) and private.effective_invoice_status(invoice.status, invoice.due_at) = 'late'
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
