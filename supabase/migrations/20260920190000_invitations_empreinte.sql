-- Relia — l'empreinte du jeton d'invitation était lisible par les membres.
--
-- `grant select (colonnes)` est **additif** : il n'a jamais restreint quoi que ce soit. Supabase
-- accorde par défaut le SELECT sur toute la table au rôle `authenticated`, si bien que la colonne
-- `token_hash` restait lisible — vérifié en base par `has_column_privilege`, contrairement à ce que
-- l'intention de la migration laissait croire.
--
-- L'empreinte est un SHA-256 d'un jeton de 256 bits : la connaître ne permet pas de retrouver le
-- jeton. Mais c'est une valeur dérivée d'un secret, elle n'a rien à faire dans une lecture de
-- membre, et la règle générale du projet est qu'une colonne sensible ne sort pas de la base.
--
-- L'ordre compte : retirer d'abord le privilège de table, accorder ensuite les seules colonnes
-- voulues. Les invitations sont la seule table du schéma à employer un grant de colonnes en
-- lecture ; ailleurs, les secrets ne sont jamais stockés en clair (Vault).

revoke select on public.invitations from authenticated;

grant select (id, organization_id, email, role, invited_by, expires_at, accepted_at, accepted_by, created_at)
  on public.invitations to authenticated;
