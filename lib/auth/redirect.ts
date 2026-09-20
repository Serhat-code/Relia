export const DEFAULT_AUTHENTICATED_PATH = "/app";

/**
 * Destination après connexion, lue depuis un paramètre « next » : uniquement un chemin interne,
 * pour qu'un lien piégé ne puisse pas renvoyer l'utilisateur vers un autre site.
 */
export function safeNextPath(value: unknown, fallback = DEFAULT_AUTHENTICATED_PATH): string {
  if (typeof value !== "string") return fallback;
  const isInternalPath = value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
  // Les caractères de contrôle (retours à la ligne…) sont refusés.
  return isInternalPath && !/[\x00-\x1f]/.test(value) ? value : fallback;
}
