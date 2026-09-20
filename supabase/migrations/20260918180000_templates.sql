-- Relia — modèles et scénarios de relance (palier 8, CLAUDE.md §2.5, §2.6 et §5.3).
--
-- 1. Règles de contenu vérifiées par la base à chaque écriture d'un modèle : aucune menace (§2.6),
--    aucune mention réservée aux professionnels dans un modèle pour particuliers (§2.5), aucun
--    terme interdit (§2.1). Mêmes règles que lib/compliance/template-rules.ts (parité testée).
-- 2. Six modèles système (B2B et B2C × courtois, ferme, mise en demeure), textes identiques à
--    lib/templates/system-templates.ts (vérifié par test), rattachés aux scénarios par défaut.
-- 3. Enregistrement des étapes d'un scénario en une transaction.

-- ─── Règles de contenu ─────────────────────────────────────────────────────────

-- Libellés des règles enfreintes (vide si le modèle est conforme). Le texte est mis en minuscules ;
-- un « mot » est borné par tout caractère qui n'est ni une lettre (accentuée comprise) ni un chiffre.
create function private.template_violations(p_client_type public.client_type, p_subject text, p_body text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  -- Même normalisation que normalizeForRules (lib/compliance/template-rules.ts) : caractères
  -- invisibles retirés, toute espace Unicode ramenée à une espace simple (texte collé depuis un
  -- traitement de texte), puis minuscules. Les majuscules accentuées sont repliées explicitement :
  -- lower() dépend de la configuration régionale du serveur.
  with content as (
    select translate(
      lower(regexp_replace(
        regexp_replace(
          coalesce(p_subject, '') || ' ' || coalesce(p_body, ''),
          '[' || chr(173) || chr(8203) || chr(8204) || chr(8205) || chr(8206) || chr(8207) || chr(8288) || chr(65279) || ']',
          '', 'g'),
        '[[:space:]' || chr(133) || chr(160) || chr(8192) || '-' || chr(8202) || chr(8232) || chr(8233) || chr(8239)
          || chr(8287) || chr(12288) || ']+',
        ' ', 'g')),
      'ÀÂÄÁÃÉÈÊËÎÏÍÔÖÓÙÛÜÚÇŒÆ',
      'àâäáãéèêëîïíôöóùûüúçœæ'
    ) as text
  ),
  rules (label, pattern, is_b2c_only) as (
    values
      -- §2.6 : menaces, quel que soit le type de client.
      ('saisie', 'saisi(e|es|s|r|rons|ra|ront)?', false),
      ('huissier', 'huissiers?', false),
      ('commissaire de justice', 'commissaires? de justice', false),
      ('procédure judiciaire', 'proc[ée]dures? judiciaires?', false),
      ('poursuites', 'poursuites( judiciaires)?|poursuite judiciaire', false),
      ('injonction de payer', 'injonctions? de payer', false),
      ('fichage', 'fich(age|er|é|ée|és|ées)', false),
      ('mise en recouvrement', 'mises? en recouvrement', false),
      ('tribunal', 'tribuna(l|ux)', false),
      ('avocat', 'avocats?', false),
      ('contentieux', 'contentieux', false),
      ('plainte', 'plaintes?', false),
      -- §2.1 : vocabulaire interdit.
      ('recouvrement', 'recouvrements?', false),
      ('agence', 'agence', false),
      -- §2.5 : mentions réservées aux professionnels.
      ('indemnité forfaitaire', 'indemnit[ée]s? forfaitaires?', true),
      ('40 €', '40(,00)? ?(€|euros?)', true),
      ('pénalités de retard', 'p[ée]nalit[ée]s? de retard', true),
      ('intérêts de retard', 'int[ée]r[êe]ts? (de retard|moratoires?)', true),
      ('taux de la BCE', 'bce|banque centrale europ[ée]enne', true),
      ('article L441', 'l\.? ?441(-[0-9]+)?', true),
      ('Code de commerce', 'code de commerce', true)
  )
  select coalesce(array_agg(rules.label order by rules.label), '{}')
  from rules, content
  where (not rules.is_b2c_only or p_client_type = 'b2c')
    and content.text ~ ('(^|[^a-z0-9à-ÿœæ])(' || rules.pattern || ')($|[^a-z0-9à-ÿœæ])')
$$;

create function private.check_template_content() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  violations text[] := private.template_violations(new.client_type, new.subject, new.body_markdown);
begin
  if cardinality(violations) > 0 then
    raise exception 'Modèle refusé : %', array_to_string(violations, ', ') using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger templates_check_content
  before insert or update of client_type, subject, body_markdown on public.templates
  for each row execute function private.check_template_content();

grant execute on function private.template_violations(public.client_type, text, text) to authenticated;

-- Un membre crée ses modèles et en modifie le texte ; le type de client, le ton et le caractère
-- « système » ne se changent pas (une copie garde ceux de son modèle d'origine).
revoke insert, update on public.templates from authenticated;
grant insert (organization_id, name, client_type, tone, subject, body_markdown, variables) on public.templates to authenticated;
grant update (name, subject, body_markdown, variables) on public.templates to authenticated;

-- ─── Modèles système ───────────────────────────────────────────────────────────

insert into public.templates (id, name, client_type, tone, subject, body_markdown, variables, is_system)
select
  system_template.id::uuid, system_template.name, system_template.client_type::public.client_type,
  system_template.tone::public.reminder_tone, system_template.subject, system_template.body_markdown,
  system_template.variables, true
from (values
  ('5a4d1c3e-0b1b-4c1e-8a01-000000000101', 'Rappel courtois — professionnels', 'b2b', 'courtois',
   'Facture {{numero_facture}} : petit rappel',
   $tpl${{salutation}}

Sauf erreur de notre part, notre facture n° {{numero_facture}} d'un montant de {{montant}} {{statut_echeance}}.

Si le règlement est déjà parti, merci de ne pas tenir compte de ce message. Dans le cas contraire, nous vous remercions de bien vouloir le programmer.

Nous restons à votre disposition pour toute question.

Bien cordialement,
{{nom_entreprise}}$tpl$,
   '["numero_facture","salutation","montant","statut_echeance","nom_entreprise"]'::jsonb),
  ('5a4d1c3e-0b1b-4c1e-8a01-000000000102', 'Relance ferme — professionnels', 'b2b', 'ferme',
   'Facture {{numero_facture}} en attente de règlement',
   $tpl${{salutation}}

Malgré notre précédent message, notre facture n° {{numero_facture}} d'un montant de {{montant}}, échue le {{date_echeance}}, reste impayée à ce jour ({{retard}} de retard).

Nous vous remercions de procéder à son règlement dans les meilleurs délais.

Pour rappel, conformément à l'article L441-10 du Code de commerce, tout retard de paiement entre professionnels rend exigibles des pénalités de retard au taux de la BCE majoré de 10 points, ainsi qu'une indemnité forfaitaire de 40 €.

Si un point de la facture pose question, répondez simplement à ce message : nous le regarderons ensemble.

Cordialement,
{{nom_entreprise}}$tpl$,
   '["numero_facture","salutation","montant","date_echeance","retard","nom_entreprise"]'::jsonb),
  ('5a4d1c3e-0b1b-4c1e-8a01-000000000103', 'Mise en demeure — professionnels', 'b2b', 'mise_en_demeure',
   'Mise en demeure de payer : facture {{numero_facture}}',
   $tpl${{salutation}}

Nos précédentes relances concernant la facture n° {{numero_facture}} sont restées sans effet.

**Montant dû :** {{montant}}
**Échéance dépassée :** {{date_echeance}} ({{retard}} de retard)

Par la présente, nous vous mettons en demeure de régler cette somme sous huit jours à compter de la réception de ce message.

Les pénalités de retard au taux de la BCE majoré de 10 points et l'indemnité forfaitaire de 40 € prévues par l'article L441-10 du Code de commerce sont exigibles.

À défaut de règlement dans ce délai, le dossier pourra être confié à un tiers.

{{nom_entreprise}}$tpl$,
   '["numero_facture","salutation","montant","date_echeance","retard","nom_entreprise"]'::jsonb),
  ('5a4d1c3e-0b1b-4c1e-8a01-000000000201', 'Rappel courtois — particuliers', 'b2c', 'courtois',
   'Votre facture {{numero_facture}}',
   $tpl${{salutation}}

Nous nous permettons de vous rappeler que la facture n° {{numero_facture}} d'un montant de {{montant}} {{statut_echeance}}.

Si vous l'avez déjà réglée, merci de ne pas tenir compte de ce message.

Pour toute question, il vous suffit de répondre à cet e-mail.

Bien cordialement,
{{nom_entreprise}}$tpl$,
   '["numero_facture","salutation","montant","statut_echeance","nom_entreprise"]'::jsonb),
  ('5a4d1c3e-0b1b-4c1e-8a01-000000000202', 'Relance — particuliers', 'b2c', 'ferme',
   'Facture {{numero_facture}} : règlement en attente',
   $tpl${{salutation}}

Nous n'avons pas encore reçu le règlement de la facture n° {{numero_facture}} d'un montant de {{montant}}, arrivée à échéance le {{date_echeance}}.

Nous vous remercions de bien vouloir procéder à son règlement dès que possible. Si vous rencontrez une difficulté, répondez-nous simplement : nous pouvons en parler et trouver ensemble une solution, par exemple un paiement en plusieurs fois.

Bien cordialement,
{{nom_entreprise}}$tpl$,
   '["numero_facture","salutation","montant","date_echeance","nom_entreprise"]'::jsonb),
  ('5a4d1c3e-0b1b-4c1e-8a01-000000000203', 'Mise en demeure — particuliers', 'b2c', 'mise_en_demeure',
   'Mise en demeure de payer : facture {{numero_facture}}',
   $tpl${{salutation}}

Malgré nos relances, la facture n° {{numero_facture}} reste impayée.

**Montant dû :** {{montant}}
**Échéance :** {{date_echeance}}

Nous vous mettons en demeure de régler cette somme dans un délai de quinze jours à compter de la réception de ce message.

Si vous rencontrez une difficulté de paiement, répondez-nous : nous restons ouverts à un échéancier.

À défaut de règlement dans ce délai, le dossier pourra être confié à un tiers.

{{nom_entreprise}}$tpl$,
   '["numero_facture","salutation","montant","date_echeance","nom_entreprise"]'::jsonb)
) as system_template (id, name, client_type, tone, subject, body_markdown, variables);

-- Étapes des scénarios par défaut : le modèle système du même type de client et du même ton.
create function private.system_template_id(p_client_type public.client_type, p_tone public.reminder_tone)
returns uuid
language sql
stable
set search_path = ''
as $$
  select template.id from public.templates as template
  where template.is_system and template.client_type = p_client_type and template.tone = p_tone
  order by template.created_at
  limit 1
$$;

grant execute on function private.system_template_id(public.client_type, public.reminder_tone) to authenticated;

create or replace function private.create_default_sequences(p_organization_id uuid) returns void
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
  insert into public.reminder_steps (organization_id, sequence_id, position, offset_days, tone, template_id)
  select p_organization_id, sequences.id, step.position, step.offset_days, step.tone::public.reminder_tone,
    private.system_template_id(sequences.client_type, step.tone::public.reminder_tone)
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

-- Organisations déjà créées : leurs étapes sans modèle reçoivent le modèle système correspondant.
update public.reminder_steps as step
set template_id = private.system_template_id(sequence.client_type, step.tone)
from public.reminder_sequences as sequence
where sequence.id = step.sequence_id and step.template_id is null;

-- ─── Enregistrement des étapes d'un scénario ───────────────────────────────────
-- Les étapes existantes gardent leur identifiant (les relances planifiées y restent rattachées).
-- Règles (mêmes que lib/sequences/steps.ts) : 1 à 8 étapes, échéances strictement croissantes,
-- de -60 à 365 jours ; un ton ferme ou une mise en demeure seulement après l'échéance.
-- Sans modèle choisi, l'étape utilise le modèle système du même type de client et du même ton.
create function public.save_sequence_steps(p_sequence_id uuid, p_steps jsonb) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sequence_row public.reminder_sequences%rowtype;
  step_count integer;
  step jsonb;
  step_position integer := 0;
  previous_offset integer;
  step_offset integer;
  step_tone public.reminder_tone;
  step_template uuid;
  step_id uuid;
begin
  select * into sequence_row from public.reminder_sequences where id = p_sequence_id for update;
  if not found then
    raise exception 'Scénario introuvable' using errcode = 'P0002';
  end if;

  if jsonb_typeof(p_steps) is distinct from 'array' then
    raise exception 'Étapes invalides' using errcode = '22023';
  end if;
  step_count := jsonb_array_length(p_steps);
  if step_count not between 1 and 8 then
    raise exception 'Un scénario compte de 1 à 8 étapes' using errcode = '22023';
  end if;

  -- Étapes retirées : supprimées (les relances déjà planifiées perdent leur rattachement).
  delete from public.reminder_steps as existing
  where existing.sequence_id = p_sequence_id
    and existing.id not in (
      select (item ->> 'id')::uuid from jsonb_array_elements(p_steps) as item where item ? 'id' and item ->> 'id' is not null
    );
  -- Positions provisoires : la contrainte d'unicité ne gêne pas le réordonnancement.
  update public.reminder_steps set position = position + 100 where sequence_id = p_sequence_id;

  for step in select value from jsonb_array_elements(p_steps) loop
    step_position := step_position + 1;
    if coalesce(step ->> 'offset_days', '') !~ '^-?[0-9]{1,4}$' then
      raise exception 'Étape %: décalage hors limites (de -60 à 365 jours)', step_position using errcode = '22023';
    end if;
    if coalesce(step ->> 'tone', '') not in ('courtois', 'ferme', 'mise_en_demeure') then
      raise exception 'Étape %: ton inconnu', step_position using errcode = '22023';
    end if;
    step_offset := (step ->> 'offset_days')::integer;
    step_tone := (step ->> 'tone')::public.reminder_tone;
    step_template := coalesce(
      nullif(step ->> 'template_id', '')::uuid,
      private.system_template_id(sequence_row.client_type, step_tone)
    );

    if step_offset is null or step_offset not between -60 and 365 then
      raise exception 'Étape %: décalage hors limites (de -60 à 365 jours)', step_position using errcode = '22023';
    end if;
    if previous_offset is not null and step_offset <= previous_offset then
      raise exception 'Étape %: les échéances doivent être strictement croissantes', step_position using errcode = '22023';
    end if;
    if step_tone <> 'courtois' and step_offset < 1 then
      raise exception 'Étape %: un ton ferme vient après l''échéance', step_position using errcode = '22023';
    end if;
    previous_offset := step_offset;

    step_id := nullif(step ->> 'id', '')::uuid;
    if step_id is null then
      insert into public.reminder_steps (organization_id, sequence_id, position, offset_days, tone, template_id)
      values (sequence_row.organization_id, p_sequence_id, step_position, step_offset, step_tone, step_template);
    else
      update public.reminder_steps
      set position = step_position, offset_days = step_offset, tone = step_tone, template_id = step_template
      where id = step_id and sequence_id = p_sequence_id;
      if not found then
        raise exception 'Étape % introuvable dans ce scénario', step_position using errcode = 'P0002';
      end if;
    end if;
  end loop;

  insert into public.audit_logs (organization_id, actor_type, actor_id, action, entity_type, entity_id, payload)
  values (sequence_row.organization_id, 'user', (select auth.uid()), 'sequence.updated', 'sequence', p_sequence_id,
    jsonb_build_object('steps', step_count));

  return step_count;
end;
$$;

revoke all on function public.save_sequence_steps(uuid, jsonb) from public, anon;
grant execute on function public.save_sequence_steps(uuid, jsonb) to authenticated;
