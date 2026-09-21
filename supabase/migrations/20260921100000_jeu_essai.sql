-- Relia — jeu d'essai en un clic (CLAUDE.md §1 : « prise en main en moins de 10 minutes »).
--
-- Un compte neuf est vide : pour voir Relia travailler, il faut d'abord préparer un CSV et connecter
-- une boîte. Beaucoup abandonnent avant. Ce jeu d'essai crée un client fictif et cinq factures dans
-- des états différents, de quoi peupler le tableau de bord immédiatement.
--
-- Le détail qui compte : **le client fictif porte l'adresse du membre qui charge le jeu**. La relance
-- lui revient donc à lui, il peut y répondre, et la boucle complète — envoi, lecture de la réponse,
-- détection de la promesse — se teste sans impliquer un vrai client.
--
-- Les lignes sont marquées : les retirer est exact, pas une recherche de nom approximative.

alter table public.debtors add column is_sample boolean not null default false;
alter table public.invoices add column is_sample boolean not null default false;

comment on column public.debtors.is_sample is 'Ligne du jeu d''essai : effaçable d''un bloc, jamais confondue avec une vraie.';
comment on column public.invoices.is_sample is 'Ligne du jeu d''essai : effaçable d''un bloc, jamais confondue avec une vraie.';

create index invoices_sample_idx on public.invoices (organization_id) where is_sample;

/*
 * Charge le jeu d'essai. Réservé au propriétaire et aux administrateurs, une seule fois : recharger
 * sans avoir effacé fausserait les chiffres du tableau de bord.
 */
create function public.load_sample_data() returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id();
  v_actor uuid := auth.uid();
  v_email text;
  v_currency text;
  v_debtor_id uuid;
begin
  if v_organization_id is null or v_actor is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if private.current_member_role() not in ('owner', 'admin') then
    raise exception 'Seuls le propriétaire et les administrateurs peuvent charger un jeu d''essai' using errcode = '42501';
  end if;
  if exists (select 1 from public.debtors where organization_id = v_organization_id and is_sample) then
    raise exception 'Un jeu d''essai est déjà chargé' using errcode = '23505';
  end if;

  select lower(email) into v_email from auth.users where id = v_actor;
  if v_email is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  select coalesce(default_currency, 'EUR') into v_currency
  from public.organizations where id = v_organization_id;

  -- Personne morale avec SIREN : le score de risque s'applique, ce qui rend la démonstration
  -- complète (§2.4). Le SIREN est celui des jeux de test du dépôt, pas celui d'une vraie société.
  insert into public.debtors (organization_id, name, siren, is_legal_entity, client_type, contact_email, contact_name, notes, is_sample)
  values (
    v_organization_id, 'Client d''essai (Relia)', '732829320', true, 'b2b', v_email, 'Vous-même',
    'Client fictif du jeu d''essai. Son adresse est la vôtre : les relances vous reviennent.', true
  )
  returning id into v_debtor_id;

  -- Cinq états : à échoir, deux retards d'ancienneté différente, un très ancien, une réglée.
  insert into public.invoices (
    organization_id, debtor_id, number, amount_ht, amount_ttc, currency,
    issued_at, due_at, status, paid_at, source, is_sample
  )
  values
    (v_organization_id, v_debtor_id, 'ESSAI-001', 1250, 1500, v_currency,
     current_date - 20, current_date + 10, 'pending', null, 'manual', true),
    (v_organization_id, v_debtor_id, 'ESSAI-002', 2000, 2400, v_currency,
     current_date - 42, current_date - 12, 'pending', null, 'manual', true),
    (v_organization_id, v_debtor_id, 'ESSAI-003', 700, 840, v_currency,
     current_date - 75, current_date - 45, 'pending', null, 'manual', true),
    (v_organization_id, v_debtor_id, 'ESSAI-004', 3100, 3720, v_currency,
     current_date - 125, current_date - 95, 'pending', null, 'manual', true),
    (v_organization_id, v_debtor_id, 'ESSAI-005', 900, 1080, v_currency,
     current_date - 60, current_date - 30, 'paid', current_date - 25, 'manual', true);

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (v_organization_id, 'user', v_actor, 'sample.loaded', 'organization', v_organization_id,
    jsonb_build_object('invoices', 5));

  return v_debtor_id;
end;
$$;

/* Efface le jeu d'essai, et lui seul : relances, réponses et promesses suivent en cascade. */
create function public.clear_sample_data() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id();
  v_actor uuid := auth.uid();
  v_removed integer;
begin
  if v_organization_id is null or private.current_member_role() not in ('owner', 'admin') then
    raise exception 'Seuls le propriétaire et les administrateurs peuvent effacer le jeu d''essai' using errcode = '42501';
  end if;

  delete from public.invoices where organization_id = v_organization_id and is_sample;
  get diagnostics v_removed = row_count;
  delete from public.debtors where organization_id = v_organization_id and is_sample;

  if v_removed > 0 then
    insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
    values (v_organization_id, 'user', v_actor, 'sample.cleared', 'organization', v_organization_id,
      jsonb_build_object('invoices', v_removed));
  end if;
  return v_removed;
end;
$$;

revoke all on function public.load_sample_data() from public, anon;
revoke all on function public.clear_sample_data() from public, anon;
grant execute on function public.load_sample_data() to authenticated;
grant execute on function public.clear_sample_data() to authenticated;
