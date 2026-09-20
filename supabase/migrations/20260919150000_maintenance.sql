-- Relia — maintenance (palier 15, CLAUDE.md §2.2 et §9).
--
-- 1. Purge au terme de la durée de conservation de chaque organisation (cron hebdomadaire).
-- 2. Recalcul quotidien des scores de risque : ils dépendent de la date (retard en cours).
-- 3. Effacement complet d'une organisation, à la demande de son propriétaire (fin de contrat).
-- Toutes réservées à la clé de service.

-- Factures closes (payées ou annulées) depuis plus longtemps que la durée de conservation, avec leurs
-- relances, réponses et promesses (suppression en cascade) ; débiteurs sans plus aucune facture ;
-- journal d'audit plus ancien que la durée. Tracé sans donnée personnelle, seulement des nombres.
create function public.purge_expired_data() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization record;
  cutoff timestamptz;
  purged_invoices integer;
  purged_debtors integer;
  purged_logs integer;
  total_invoices integer := 0;
  total_debtors integer := 0;
  total_logs integer := 0;
begin
  for organization in select id, retention_months from public.organizations order by id loop
    cutoff := now() - make_interval(months => organization.retention_months);

    delete from public.invoices
    where organization_id = organization.id and closed_at is not null and closed_at < cutoff;
    get diagnostics purged_invoices = row_count;

    delete from public.debtors as debtor
    where debtor.organization_id = organization.id
      and debtor.created_at < cutoff
      and not exists (select 1 from public.invoices as invoice where invoice.debtor_id = debtor.id);
    get diagnostics purged_debtors = row_count;

    purged_logs := private.purge_audit_logs(organization.id, cutoff);

    if purged_invoices + purged_debtors + purged_logs > 0 then
      insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
      values (organization.id, 'system', null, 'data.purged', 'organization', organization.id,
        jsonb_build_object('invoices', purged_invoices, 'debtors', purged_debtors, 'audit_logs', purged_logs,
          'retention_months', organization.retention_months));
    end if;

    total_invoices := total_invoices + purged_invoices;
    total_debtors := total_debtors + purged_debtors;
    total_logs := total_logs + purged_logs;
  end loop;

  return jsonb_build_object('invoices', total_invoices, 'debtors', total_debtors, 'audit_logs', total_logs);
end;
$$;

-- Scores de risque et délais de paiement de tous les débiteurs (seules les personnes morales avec un
-- historique reçoivent un score, §2.4). Renvoie le nombre de débiteurs recalculés.
create function public.refresh_all_debtor_stats() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  debtor_ids uuid[];
begin
  select coalesce(array_agg(id), '{}') into debtor_ids from public.debtors;
  perform private.refresh_debtor_payment_stats(debtor_ids);
  return cardinality(debtor_ids);
end;
$$;

-- Effacement d'une organisation et de toutes ses données (factures, débiteurs, relances, réponses,
-- journal, boîte d'envoi et ses secrets). Renvoie les comptes de ses membres, que le serveur supprime
-- ensuite de l'authentification. Irréversible : le serveur vérifie au préalable que la demande vient du
-- propriétaire et qu'aucun abonnement n'est en cours.
create function public.erase_organization(p_organization_id uuid) returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_ids uuid[];
begin
  select coalesce(array_agg(id), '{}') into member_ids from public.users where organization_id = p_organization_id;
  perform 1 from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'Organisation introuvable' using errcode = 'P0002';
  end if;
  perform private.delete_organization(p_organization_id);
  return member_ids;
end;
$$;

revoke all on function public.purge_expired_data() from public, anon, authenticated;
revoke all on function public.refresh_all_debtor_stats() from public, anon, authenticated;
revoke all on function public.erase_organization(uuid) from public, anon, authenticated;
grant execute on function public.purge_expired_data() to service_role;
grant execute on function public.refresh_all_debtor_stats() to service_role;
grant execute on function public.erase_organization(uuid) to service_role;
