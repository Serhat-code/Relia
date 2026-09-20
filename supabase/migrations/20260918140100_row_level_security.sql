-- Relia — sécurité au niveau des lignes (CLAUDE.md §4 et §8).
--
-- RLS activée sur toutes les tables, sans exception : un utilisateur n'accède qu'aux lignes de
-- son organisation. Le rôle anonyme n'a aucun accès. Les colonnes sensibles (offre, Stripe, DPA,
-- rôle d'un membre) et les tables alimentées par le serveur (boîtes d'envoi, intégrations) ne
-- sont modifiables qu'avec la clé de service, côté serveur.

-- ─── Fonctions utilisées par les politiques ────────────────────────────────────

create function private.current_organization_id() returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id from public.users where id = (select auth.uid())
$$;

create function private.current_member_role() returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.users where id = (select auth.uid())
$$;

grant usage on schema private to authenticated, service_role;
grant execute on function private.current_organization_id() to authenticated;
grant execute on function private.current_member_role() to authenticated;

-- ─── Privilèges de base ────────────────────────────────────────────────────────

-- Aucun accès anonyme ; TRUNCATE contourne la RLS : retiré aux rôles d'API.
revoke all on all tables in schema public from anon;
revoke truncate on all tables in schema public from authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate on tables from authenticated;

-- ─── Activation de la RLS ──────────────────────────────────────────────────────

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.email_accounts enable row level security;
alter table public.integrations enable row level security;
alter table public.debtors enable row level security;
alter table public.invoices enable row level security;
alter table public.reminder_sequences enable row level security;
alter table public.templates enable row level security;
alter table public.reminder_steps enable row level security;
alter table public.reminders enable row level security;
alter table public.promises enable row level security;
alter table public.audit_logs enable row level security;

-- ─── Organisation : lecture par ses membres, réglages par les responsables ─────

create policy "Membres : lecture de leur organisation"
  on public.organizations for select to authenticated
  using (id = (select private.current_organization_id()));

create policy "Responsables : réglages de leur organisation"
  on public.organizations for update to authenticated
  using (
    id = (select private.current_organization_id())
    and (select private.current_member_role()) in ('owner', 'admin')
  )
  with check (id = (select private.current_organization_id()));

-- Offre, identifiants Stripe et acceptation du DPA : réservés au serveur.
revoke insert, update, delete on public.organizations from authenticated;
grant update (name, siren, retention_months) on public.organizations to authenticated;

-- ─── Membres : lecture de l'équipe, chacun modifie son propre profil ───────────

create policy "Membres : lecture de leur équipe"
  on public.users for select to authenticated
  using (organization_id = (select private.current_organization_id()));

create policy "Membres : mise à jour de leur profil"
  on public.users for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Rôle et rattachement : réservés au serveur.
revoke insert, update, delete on public.users from authenticated;
grant update (full_name) on public.users to authenticated;

-- ─── Données métier : accès complet dans son organisation ─────────────────────

create policy "Membres : données de leur organisation"
  on public.debtors for all to authenticated
  using (organization_id = (select private.current_organization_id()))
  with check (organization_id = (select private.current_organization_id()));

create policy "Membres : données de leur organisation"
  on public.invoices for all to authenticated
  using (organization_id = (select private.current_organization_id()))
  with check (organization_id = (select private.current_organization_id()));

create policy "Membres : données de leur organisation"
  on public.reminder_sequences for all to authenticated
  using (organization_id = (select private.current_organization_id()))
  with check (organization_id = (select private.current_organization_id()));

create policy "Membres : données de leur organisation"
  on public.reminder_steps for all to authenticated
  using (organization_id = (select private.current_organization_id()))
  with check (organization_id = (select private.current_organization_id()));

create policy "Membres : données de leur organisation"
  on public.reminders for all to authenticated
  using (organization_id = (select private.current_organization_id()))
  with check (organization_id = (select private.current_organization_id()));

create policy "Membres : données de leur organisation"
  on public.promises for all to authenticated
  using (organization_id = (select private.current_organization_id()))
  with check (organization_id = (select private.current_organization_id()));

-- ─── Modèles : système en lecture pour tous, les siens en écriture ─────────────

create policy "Membres : modèles système et modèles de leur organisation"
  on public.templates for select to authenticated
  using (organization_id is null or organization_id = (select private.current_organization_id()));

create policy "Membres : création de modèles de leur organisation"
  on public.templates for insert to authenticated
  with check (organization_id = (select private.current_organization_id()));

create policy "Membres : modification des modèles de leur organisation"
  on public.templates for update to authenticated
  using (organization_id = (select private.current_organization_id()))
  with check (organization_id = (select private.current_organization_id()));

create policy "Membres : suppression des modèles de leur organisation"
  on public.templates for delete to authenticated
  using (organization_id = (select private.current_organization_id()));

-- ─── Boîtes d'envoi et intégrations : écrites par le serveur (OAuth, secrets) ──

create policy "Membres : lecture des boîtes d'envoi de leur organisation"
  on public.email_accounts for select to authenticated
  using (organization_id = (select private.current_organization_id()));

create policy "Responsables : déconnexion d'une boîte d'envoi"
  on public.email_accounts for delete to authenticated
  using (
    organization_id = (select private.current_organization_id())
    and (select private.current_member_role()) in ('owner', 'admin')
  );

create policy "Membres : lecture des intégrations de leur organisation"
  on public.integrations for select to authenticated
  using (organization_id = (select private.current_organization_id()));

create policy "Responsables : déconnexion d'une intégration"
  on public.integrations for delete to authenticated
  using (
    organization_id = (select private.current_organization_id())
    and (select private.current_member_role()) in ('owner', 'admin')
  );

revoke insert, update on public.email_accounts from authenticated;
revoke insert, update on public.integrations from authenticated;

-- ─── Journal d'audit : lecture, et insertion de ses propres actions ────────────
-- Les actions du système et de l'IA sont tracées par le serveur (clé de service).

create policy "Membres : lecture du journal de leur organisation"
  on public.audit_logs for select to authenticated
  using (organization_id = (select private.current_organization_id()));

create policy "Membres : traçage de leurs propres actions"
  on public.audit_logs for insert to authenticated
  with check (
    organization_id = (select private.current_organization_id())
    and actor_type = 'user'
    and actor_id = (select auth.uid())
  );

revoke update, delete on public.audit_logs from authenticated;
