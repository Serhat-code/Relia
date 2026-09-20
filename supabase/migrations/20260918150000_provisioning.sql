-- Relia — provisionnement d'une organisation à l'inscription (palier 5, CLAUDE.md §2.2 et §5.1).
--
-- Appelé par le serveur (clé de service) juste après la création du compte Supabase Auth.
-- Tout se fait dans une seule transaction : organisation avec l'acceptation du DPA (horodatage,
-- version, IP), membre propriétaire, scénarios par défaut B2B et B2C, entrées d'audit.

-- Scénarios fournis par défaut (§5.3), modifiables ensuite. B2C : délais plus longs (§2.5).
create function private.create_default_sequences(p_organization_id uuid) returns void
language sql
security definer
set search_path = ''
as $$
  with sequences as (
    insert into public.reminder_sequences (organization_id, name, client_type, is_default)
    values
      (p_organization_id, 'Professionnels (B2B)', 'b2b', true),
      (p_organization_id, 'Particuliers (B2C)', 'b2c', true)
    returning id, client_type
  )
  insert into public.reminder_steps (organization_id, sequence_id, position, offset_days, tone)
  select p_organization_id, sequences.id, step.position, step.offset_days, step.tone::public.reminder_tone
  from sequences
  join (values
    ('b2b', 1, -3, 'courtois'),
    ('b2b', 2, 7, 'courtois'),
    ('b2b', 3, 15, 'ferme'),
    ('b2b', 4, 30, 'mise_en_demeure'),
    ('b2c', 1, -3, 'courtois'),
    ('b2c', 2, 10, 'courtois'),
    ('b2c', 3, 25, 'ferme'),
    ('b2c', 4, 45, 'mise_en_demeure')
  ) as step (client_type, position, offset_days, tone)
    on step.client_type = sequences.client_type::text
$$;

create function public.provision_organization(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_organization_name text,
  p_siren text,
  p_dpa_version text,
  p_dpa_ip inet
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization_id uuid;
begin
  -- Idempotent : une nouvelle tentative renvoie l'organisation déjà créée.
  select member.organization_id into new_organization_id from public.users as member where member.id = p_user_id;
  if found then
    return new_organization_id;
  end if;

  insert into public.organizations (name, siren, dpa_accepted_at, dpa_version, dpa_ip)
  values (p_organization_name, nullif(p_siren, ''), now(), p_dpa_version, p_dpa_ip)
  returning id into new_organization_id;

  insert into public.users (id, organization_id, email, full_name, role)
  values (p_user_id, new_organization_id, p_email, nullif(p_full_name, ''), 'owner');

  perform private.create_default_sequences(new_organization_id);

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values
    (new_organization_id, 'user', p_user_id, 'organization.created', 'organization', new_organization_id,
      jsonb_build_object('name', p_organization_name)),
    (new_organization_id, 'user', p_user_id, 'dpa.accepted', 'organization', new_organization_id,
      jsonb_build_object('version', p_dpa_version, 'ip', host(p_dpa_ip)));

  return new_organization_id;
end;
$$;

revoke all on function public.provision_organization(uuid, text, text, text, text, text, inet) from public, anon, authenticated;
grant execute on function public.provision_organization(uuid, text, text, text, text, text, inet) to service_role;
