-- Relia — abonnement (palier 13, CLAUDE.md §5.9).
--
-- Stripe encaisse uniquement l'abonnement à Relia, jamais les règlements des clients de nos clients
-- (§2.1). Essai gratuit de 14 jours sans carte ; ensuite, sans abonnement actif, Relia ne prépare
-- plus et n'envoie plus de relances (les données restent consultables).

alter table public.organizations
  add column trial_ends_at timestamptz,
  add column subscription_status text check (subscription_status in (
    'active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'
  )),
  add column current_period_end timestamptz,
  add column cancel_at_period_end boolean not null default false;

update public.organizations set trial_ends_at = created_at + interval '14 days' where trial_ends_at is null;
alter table public.organizations
  alter column trial_ends_at set default (now() + interval '14 days'),
  alter column trial_ends_at set not null;

-- Accès au service : abonnement actif (un paiement en retard garde l'accès pendant les relances de
-- Stripe), ou essai en cours. Même règle que hasActiveAccess (lib/billing/access.ts), parité testée.
create function private.has_active_access(p_organization_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select organization.subscription_status in ('active', 'trialing', 'past_due')
      or organization.trial_ends_at > now()
    from public.organizations as organization
    where organization.id = p_organization_id
  ), false)
$$;

-- Envoi des relances (voir la migration « reminders ») : rien ne part pour une organisation sans accès.
create or replace function public.claim_due_reminders(p_limit integer) returns setof public.reminders
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
      and private.has_active_access(candidate.organization_id)
    order by candidate.scheduled_at
    limit least(greatest(p_limit, 1), 200)
    for update skip locked
  )
  returning *
$$;

create or replace function public.claim_reminder(p_reminder_id uuid) returns setof public.reminders
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
      and private.has_active_access(candidate.organization_id)
    for update skip locked
  )
  returning *
$$;

-- État de l'abonnement, relu chez Stripe à chaque événement (webhook, clé de service) : l'ordre
-- d'arrivée des événements n'a donc pas d'importance. Tracé sans donnée personnelle.
create function public.apply_stripe_subscription(
  p_organization_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_plan public.plan_tier,
  p_status text,
  p_cancel_at_period_end boolean,
  p_current_period_end timestamptz default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous public.organizations%rowtype;
begin
  if p_plan = 'trial' then
    raise exception 'Offre invalide' using errcode = '22023';
  end if;
  select * into previous from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'Organisation introuvable' using errcode = 'P0002';
  end if;
  -- Un client Stripe ne change pas d'organisation.
  if previous.stripe_customer_id is not null and previous.stripe_customer_id <> p_customer_id then
    raise exception 'Client Stripe différent de celui de l''organisation' using errcode = '42501';
  end if;

  update public.organizations
  set stripe_customer_id = p_customer_id,
      stripe_subscription_id = p_subscription_id,
      plan = p_plan,
      subscription_status = p_status,
      current_period_end = p_current_period_end,
      cancel_at_period_end = p_cancel_at_period_end
  where id = p_organization_id;

  if previous.plan is distinct from p_plan
    or previous.subscription_status is distinct from p_status
    or previous.cancel_at_period_end is distinct from p_cancel_at_period_end
  then
    insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
    values (p_organization_id, 'system', null, 'subscription.updated', 'organization', p_organization_id,
      jsonb_build_object('plan', p_plan, 'status', p_status, 'cancel_at_period_end', p_cancel_at_period_end,
        'previous_status', previous.subscription_status));
  end if;
end;
$$;

revoke all on function public.apply_stripe_subscription(uuid, text, text, public.plan_tier, text, boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription(uuid, text, text, public.plan_tier, text, boolean, timestamptz)
  to service_role;
