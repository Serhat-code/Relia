-- Relia — jeu de données de démonstration (développement local uniquement).
-- Chargé par `supabase db reset` après les migrations. Données entièrement fictives.
--
-- Comptes (mot de passe local : relia-demo) :
--   demo@relia.local   → Atelier Démo   (propriétaire)
--   autre@relia.local  → Studio Témoin  (propriétaire) — pour vérifier l'isolation à la main

-- ─── Comptes d'authentification ────────────────────────────────────────────────

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', account.id, 'authenticated', 'authenticated', account.email,
  extensions.crypt('relia-demo', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', account.full_name),
  now(), now(), '', '', '', ''
from (values
  ('00000000-0000-4000-8000-00000000a001'::uuid, 'demo@relia.local', 'Camille Démo'),
  ('00000000-0000-4000-8000-00000000b001'::uuid, 'autre@relia.local', 'Sacha Témoin')
) as account (id, email, full_name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users
where id in ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000b001');

-- ─── Organisations et membres ──────────────────────────────────────────────────

insert into public.organizations (id, name, siren, plan, dpa_accepted_at, dpa_version, dpa_ip) values
  ('00000000-0000-4000-8000-0000000000a0', 'Atelier Démo', '900000010', 'trial', now(), '2026-09', '127.0.0.1'),
  ('00000000-0000-4000-8000-0000000000b0', 'Studio Témoin', '900000020', 'trial', now(), '2026-09', '127.0.0.1');

insert into public.users (id, organization_id, email, full_name, role) values
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-0000000000a0', 'demo@relia.local', 'Camille Démo', 'owner'),
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-0000000000b0', 'autre@relia.local', 'Sacha Témoin', 'owner');

-- ─── Débiteurs : personne morale, entreprise individuelle, particulier ─────────

insert into public.debtors (
  id, organization_id, name, siren, is_legal_entity, client_type, contact_email, contact_name,
  risk_score, payment_behavior_days
) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a0', 'Menuiserie Caradec SAS',
   '900000101', true, 'b2b', 'compta@caradec.example', 'Yann Caradec', 35, 18),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000a0', 'Cabinet Vasseur SARL',
   '900000102', true, 'b2b', 'factures@vasseur.example', 'Claire Vasseur', 12, 4),
  -- Entreprise individuelle : SIREN, mais personne physique → jamais de score (§2.4).
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000a0', 'Studio Brume',
   '900000103', false, 'b2b', 'contact@studio-brume.example', 'Lou Brume', null, 9),
  -- Particulier : B2C, ni SIREN ni score ; aucun modèle B2B ne lui sera appliqué (§2.5).
  ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000a0', 'Dominique Lefort',
   null, false, 'b2c', 'dominique.lefort@particulier.example', null, null, null),
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000b0', 'Boulangerie Lenoir SAS',
   '900000201', true, 'b2b', 'gestion@lenoir.example', 'Hugo Lenoir', 20, 7);

-- ─── Factures : tous les statuts ───────────────────────────────────────────────

insert into public.invoices (
  organization_id, debtor_id, number, amount_ht, amount_ttc, issued_at, due_at, paid_at, status, source
) values
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-0000000000d1', 'F-2026-0142', 3566.67, 4280.00, '2026-07-13', '2026-08-12', null, 'late', 'manual'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-0000000000d3', 'F-2026-0151', 1042.08, 1250.50, '2026-08-03', '2026-09-02', null, 'promised', 'csv'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-0000000000d2', 'F-2026-0133', 8225.00, 9870.00, '2026-06-28', '2026-07-28', '2026-08-05', 'paid', 'manual'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-0000000000d1', 'F-2026-0160', 1929.83, 2315.80, '2026-08-16', '2026-09-15', null, 'disputed', 'facturx'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-0000000000d4', 'F-2026-0156', 533.33, 640.00, '2026-08-11', '2026-09-10', null, 'late', 'manual'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-0000000000d2', 'F-2026-0170', 1500.00, 1800.00, '2026-09-10', '2026-10-10', null, 'pending', 'manual'),
  ('00000000-0000-4000-8000-0000000000a0', '00000000-0000-4000-8000-0000000000d3', 'F-2026-0118', 650.00, 780.00, '2026-06-01', '2026-07-01', null, 'cancelled', 'manual'),
  ('00000000-0000-4000-8000-0000000000b0', '00000000-0000-4000-8000-0000000000e1', 'ST-2026-021', 2000.00, 2400.00, '2026-08-20', '2026-09-19', null, 'pending', 'manual');

insert into public.promises (organization_id, invoice_id, promised_amount, promised_date, source, confidence)
select organization_id, id, amount_ttc, '2026-09-30', 'email_reply', 0.92
from public.invoices
where number = 'F-2026-0151';

-- ─── Scénarios par défaut : B2B, et B2C aux délais plus longs et au ton mesuré ─

select private.create_default_sequences(id) from public.organizations;

-- ─── Relances et journal ───────────────────────────────────────────────────────

insert into public.reminders (organization_id, invoice_id, step_id, scheduled_at, status, subject, ai_generated)
select invoice.organization_id, invoice.id, step.id, now() + interval '1 day', 'awaiting_approval',
  'Facture ' || invoice.number || ' : échéance dépassée', true
from public.invoices as invoice
join public.reminder_sequences as sequence
  on sequence.organization_id = invoice.organization_id and sequence.client_type = 'b2b' and sequence.is_default
join public.reminder_steps as step on step.sequence_id = sequence.id and step.position = 3
where invoice.number = 'F-2026-0142';

insert into public.audit_logs (organization_id, actor_type, action, entity_type, entity_id, payload)
select organization_id, 'system', 'reminder.scheduled', 'invoice', invoice_id, jsonb_build_object('status', status)
from public.reminders;

-- ─── Réponses des clients (palier 11) ─────────────────────────────────────────
-- Une relance envoyée, et la réponse du client : les relances de la facture sont en pause.

insert into public.reminders (
  organization_id, invoice_id, scheduled_at, sent_at, status, subject, body, provider_message_id, provider_thread_id
)
select organization_id, id, now() - interval '3 days', now() - interval '3 days', 'sent',
  'Facture ' || number || ' : règlement attendu',
  'Bonjour, notre facture ' || number || ' reste à régler. Pouvez-vous nous indiquer la date du règlement ?',
  'demo-message-' || number, 'demo-fil-' || number
from public.invoices
where number = 'F-2026-0156';

select public.record_reply(
  reminder.organization_id, reminder.id, 'demo-reponse-' || invoice.number, now() - interval '1 day', 'paid_claim',
  'Bonjour, le virement est parti vendredi dernier, vous devriez l''avoir reçu. Bonne journée.', false, 0.6
)
from public.reminders as reminder
join public.invoices as invoice on invoice.id = reminder.invoice_id
where invoice.number = 'F-2026-0156' and reminder.status = 'sent';
