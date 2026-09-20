-- Relia — déclenchement des tâches planifiées depuis la base (CLAUDE.md §9).
--
-- Le plan Vercel Hobby refuse les crons plus fréquents qu'une fois par jour : les quatre tâches du §9
-- sont donc déclenchées par pg_cron, depuis la base de Paris, qui appelle les routes /api/cron avec le
-- secret partagé. Aucune donnée personnelle ne transite par ce déclenchement : une requête et un jeton.
-- Repasser aux crons Vercel (bloc "crons" de vercel.json) le jour où le projet passe en plan Pro :
-- il suffit alors de supprimer les tâches (select cron.unschedule('relia-…')).
--
-- Prérequis, une fois par projet, dans le tableau de bord Supabase (Database → Extensions) :
--   activer pg_cron et pg_net.
-- Puis, hors dépôt (un secret ne se versionne pas), dans l'éditeur SQL du projet :
--   select vault.create_secret('https://mon-projet.vercel.app', 'relia_cron_base_url');
--   select vault.create_secret('<valeur de CRON_SECRET>', 'relia_cron_secret');

-- Appelle une route /api/cron de l'application avec le secret partagé. Tant que l'URL ou le secret
-- manquent (projet neuf, base de test), la tâche ne fait rien plutôt que d'échouer toutes les 15 min.
create function private.call_cron_endpoint(p_path text) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  shared_secret text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'relia_cron_base_url';
  select decrypted_secret into shared_secret from vault.decrypted_secrets where name = 'relia_cron_secret';
  if base_url is null or shared_secret is null then
    return null;
  end if;

  return net.http_get(
    url => rtrim(base_url, '/') || p_path,
    headers => jsonb_build_object('Authorization', 'Bearer ' || shared_secret),
    -- Les routes disposent de 300 s (maxDuration) ; pg_net attend la réponse, sans bloquer la base.
    timeout_milliseconds => 120000
  );
end;
$$;

revoke all on function private.call_cron_endpoint(text) from public, anon, authenticated;

-- Mêmes horaires qu'au §9 (UTC, comme les crons Vercel). Réexécuter cette migration met simplement
-- les tâches à jour : pg_cron remplace une tâche de même nom.
select cron.schedule('relia-relances-preparer', '0 7 * * *', $job$select private.call_cron_endpoint('/api/cron/relances/preparer')$job$);
select cron.schedule('relia-relances-envoyer', '*/15 * * * *', $job$select private.call_cron_endpoint('/api/cron/relances/envoyer')$job$);
select cron.schedule('relia-reponses', '*/30 * * * *', $job$select private.call_cron_endpoint('/api/cron/reponses')$job$);
select cron.schedule('relia-purge', '0 4 * * 0', $job$select private.call_cron_endpoint('/api/cron/purge')$job$);
