/** Durée de validité d'une session de récupération pour choisir un nouveau mot de passe. */
export const RECOVERY_WINDOW_SECONDS = 15 * 60;

type AuthenticationMethod = { method?: unknown; timestamp?: unknown };

/**
 * Vrai si la session a été ouverte par un lien de réinitialisation depuis moins de 15 minutes.
 * Lit la liste « amr » du jeton signé par Supabase : une session ordinaire, même volée, ne
 * permet donc pas de changer le mot de passe sans repasser par l'e-mail.
 */
export function hasRecentRecovery(amr: unknown, nowSeconds: number): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some((entry: AuthenticationMethod) => {
    if (entry?.method !== "recovery" || typeof entry.timestamp !== "number") return false;
    return nowSeconds - entry.timestamp <= RECOVERY_WINDOW_SECONDS;
  });
}
