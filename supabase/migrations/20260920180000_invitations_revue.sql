-- Relia — corrections issues de la revue de sécurité des invitations (20/09/2026).
--
-- Trois durcissements. Aucun n'était exploitable en l'état, mais chacun s'écartait d'un principe
-- que le reste du projet applique.

-- 1. Supabase accorde par défaut tous les privilèges de table au rôle `authenticated` : sans ce
-- retrait, la table ne devait son étanchéité qu'à l'absence de politique d'écriture — un refus
-- implicite, qui sauterait silencieusement le jour où une politique d'INSERT serait ajoutée pour
-- un autre besoin. Toutes les autres tables du schéma portent ce retrait explicite.
revoke insert, update, delete on public.invitations from authenticated;

-- 2. Une deuxième invitation pour la même adresse heurtait l'index unique, et le message brut de
-- PostgreSQL (nom de contrainte compris) remontait jusqu'à l'écran. On refuse en français avant.
create or replace function public.create_invitation(p_email text, p_role public.member_role default 'member')
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
  if exists (select 1 from public.invitations
               where invitations.organization_id = v_organization_id
                 and lower(invitations.email) = v_email
                 and invitations.accepted_at is null) then
    raise exception 'Une invitation est déjà en attente pour cette adresse' using errcode = '23505';
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

-- 3. En PL/pgSQL, `if <condition nulle> then` n'exécute pas le bloc : avec un compte dont l'adresse
-- serait nulle, `invitation.email <> actor_email` valait NULL et la garde d'adresse était sautée en
-- silence. Seule la contrainte `not null` de public.users.email arrêtait alors la manœuvre — une
-- protection incidente, définie ailleurs. On refuse explicitement.
create or replace function public.accept_invitation(p_token text) returns uuid
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
  if actor_email is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;

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
