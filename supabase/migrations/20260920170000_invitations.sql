-- Relia — invitations d'équipe (CLAUDE.md §7 : « organisation, équipe »).
--
-- L'écran Équipe était en lecture seule, et les limites d'utilisateurs annoncées par les offres
-- n'avaient donc aucun sens. Une invitation est un lien porteur d'un jeton à usage unique : Relia
-- n'envoie aucun e-mail pour cela, le responsable transmet le lien comme il l'entend. Le jeton n'est
-- jamais stocké en clair — seule son empreinte l'est, comme un mot de passe.
--
-- L'adresse invitée doit correspondre à celle du compte qui accepte : un lien transmis par erreur
-- ne donne donc accès à rien.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 320),
  role public.member_role not null default 'member',
  -- Empreinte SHA-256 du jeton : le jeton en clair n'existe qu'une fois, dans la réponse à l'appelant.
  token_hash text not null unique,
  invited_by uuid not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- On n'invite pas un propriétaire : il n'y en a qu'un, et il se transmet à part.
  constraint invitations_role_check check (role in ('admin', 'member')),
  -- Clé composite : impossible de rattacher une invitation à l'organisation d'un autre membre.
  constraint invitations_invited_by_fkey foreign key (invited_by, organization_id)
    references public.users (id, organization_id) on delete cascade
);

create index invitations_organization_id_idx on public.invitations (organization_id);
-- Chaque clé étrangère porte son index : une suppression en cascade ne balaie pas la table.
create index invitations_invited_by_idx on public.invitations (invited_by, organization_id);
create index invitations_accepted_by_idx on public.invitations (accepted_by);

-- Une seule invitation en cours par adresse et par organisation.
create unique index invitations_pending_email_idx
  on public.invitations (organization_id, lower(email))
  where accepted_at is null;

alter table public.invitations enable row level security;

-- Les membres voient les invitations de leur organisation, jamais l'empreinte du jeton.
grant select (id, organization_id, email, role, invited_by, expires_at, accepted_at, accepted_by, created_at)
  on public.invitations to authenticated;

create policy invitations_select on public.invitations
  for select to authenticated
  using (organization_id = (select private.current_organization_id()));

-- Durée de validité d'un lien d'invitation.
create function private.invitation_validity_days() returns integer
language sql immutable set search_path = '' as $$ select 7 $$;

/*
 * Crée une invitation et renvoie le jeton en clair, une seule fois. Réservé au propriétaire et aux
 * administrateurs. Une adresse déjà membre, ou déjà invitée, est refusée.
 */
create function public.create_invitation(p_email text, p_role public.member_role default 'member')
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id();
  v_actor uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_token text;
begin
  if v_organization_id is null or v_actor is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if private.current_member_role() not in ('owner', 'admin') then
    raise exception 'Seuls le propriétaire et les administrateurs peuvent inviter' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Rôle invalide' using errcode = '22023';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Adresse e-mail invalide' using errcode = '22023';
  end if;
  if exists (select 1 from public.users where users.organization_id = v_organization_id
               and lower(users.email) = v_email) then
    raise exception 'Cette personne fait déjà partie de votre équipe' using errcode = '23505';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.invitations (organization_id, email, role, token_hash, invited_by, expires_at)
  values (
    v_organization_id, v_email, p_role,
    encode(extensions.digest(v_token, 'sha256'), 'hex'), v_actor,
    now() + make_interval(days => private.invitation_validity_days())
  )
  returning id into invitation_id;

  -- Journal : le rôle et l'identifiant suffisent, l'adresse invitée n'y figure pas (minimisation).
  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (v_organization_id, 'user', v_actor, 'team.invited', 'invitation', invitation_id,
    jsonb_build_object('role', p_role));

  token := v_token;
  return next;
end;
$$;

/*
 * Rejoint une organisation avec le jeton reçu. Appelé par un compte authentifié qui n'appartient
 * encore à aucune organisation, et dont l'adresse correspond à celle invitée.
 */
create function public.accept_invitation(p_token text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_email text;
  invitation public.invitations;
begin
  if actor is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if exists (select 1 from public.users where id = actor) then
    raise exception 'Votre compte appartient déjà à une organisation' using errcode = '23505';
  end if;

  select lower(email) into actor_email from auth.users where id = actor;

  select * into invitation from public.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found or invitation.accepted_at is not null or invitation.expires_at < now() then
    -- Message unique : on ne dit pas si le lien a existé, expiré ou déjà servi.
    raise exception 'Invitation invalide ou expirée' using errcode = '22023';
  end if;
  if invitation.email <> actor_email then
    raise exception 'Cette invitation a été émise pour une autre adresse e-mail' using errcode = '42501';
  end if;

  insert into public.users (id, organization_id, email, role)
  values (actor, invitation.organization_id, actor_email, invitation.role);

  update public.invitations
  set accepted_at = now(), accepted_by = actor
  where id = invitation.id;

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (invitation.organization_id, 'user', actor, 'team.joined', 'invitation', invitation.id,
    jsonb_build_object('role', invitation.role));

  return invitation.organization_id;
end;
$$;

/* Annule une invitation en cours. Réservé au propriétaire et aux administrateurs. */
create function public.revoke_invitation(p_invitation_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := private.current_organization_id();
  v_actor uuid := auth.uid();
begin
  if v_organization_id is null or private.current_member_role() not in ('owner', 'admin') then
    raise exception 'Seuls le propriétaire et les administrateurs peuvent annuler une invitation' using errcode = '42501';
  end if;

  delete from public.invitations
  where id = p_invitation_id
    and invitations.organization_id = v_organization_id
    and accepted_at is null;
  if not found then
    raise exception 'Invitation introuvable' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (v_organization_id, 'user', v_actor, 'team.invitation_revoked', 'invitation', p_invitation_id, '{}'::jsonb);
end;
$$;

revoke all on function public.create_invitation(text, public.member_role) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.create_invitation(text, public.member_role) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
