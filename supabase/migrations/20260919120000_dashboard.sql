-- Relia — tableau de bord (palier 12, CLAUDE.md §5.7).
--
-- Synthèse des règlements de l'organisation du membre connecté : la fonction s'exécute avec ses
-- droits (security invoker), la RLS ne lui montre que ses propres factures. Montants en euros
-- seulement (des devises différentes ne s'additionnent pas) ; statut effectif : « en retard » dès le
-- lendemain de l'échéance, à l'heure de Paris.

create function public.dashboard_summary() returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'Europe/Paris')::date as day
  ),
  open_invoices as (
    select
      invoice.amount_ttc,
      invoice.status,
      private.effective_invoice_status(invoice.status, invoice.due_at) as effective,
      (select day from today) - invoice.due_at as days_late
    from public.invoices as invoice
    where invoice.currency = 'EUR' and invoice.status in ('pending', 'late', 'promised')
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
    'open_amount', (select coalesce(sum(amount_ttc), 0) from open_invoices),
    'open_count', (select count(*) from open_invoices),
    'late_amount', (select coalesce(sum(amount_ttc), 0) from late_invoices),
    'late_count', (select count(*) from late_invoices),
    'promised_amount', (select coalesce(sum(amount_ttc), 0) from open_invoices where status = 'promised'),
    'promised_count', (select count(*) from open_invoices where status = 'promised'),
    -- Chiffre d'affaires facturé sur 90 jours (hors factures annulées) : base du DSO.
    'billed_90_days', (
      select coalesce(sum(invoice.amount_ttc), 0)
      from public.invoices as invoice
      where invoice.currency = 'EUR' and invoice.status <> 'cancelled'
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

revoke all on function public.dashboard_summary() from public, anon;
grant execute on function public.dashboard_summary() to authenticated;
