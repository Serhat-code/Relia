/** Paramètres d'URL d'une page (listes filtrées : l'état vit dans l'URL). */
export type SearchParams = Record<string, string | string[] | undefined>;

const MAX_SEARCH_LENGTH = 100;

/** Première valeur d'un paramètre répété (?q=a&q=b), chaîne vide s'il est absent. */
export const firstValue = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? "";

/**
 * Recherche passée aux fonctions SQL de liste (paramètre lié, pas de concaténation) : on retire
 * tout de même les caractères qui ont un sens pour les filtres de l'API ou pour LIKE.
 */
export function sanitizeSearch(raw: string): string {
  return raw
    .replace(/[,()"*%\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}
