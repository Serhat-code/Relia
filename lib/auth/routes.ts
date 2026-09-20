import { DEFAULT_AUTHENTICATED_PATH } from "./redirect";

/** Pages réservées aux visiteurs non connectés : un membre connecté est renvoyé dans l'application. */
const GUEST_ONLY_PATHS = new Set(["/connexion", "/inscription", "/mot-de-passe-oublie"]);

const isAppPath = (pathname: string) => pathname === "/app" || pathname.startsWith("/app/");

/** Pages d'authentification qui lisent la session (en plus de l'espace client). */
const SESSION_AUTH_PATHS = new Set([
  "/connexion",
  "/inscription",
  "/inscription/finaliser",
  "/mot-de-passe-oublie",
  "/reinitialiser",
  // Lien d'invitation : la page décide quoi afficher selon l'état de connexion.
  "/rejoindre",
]);

/** Vrai si la page a besoin de la session : elle est rafraîchie par le middleware, les autres pages n'y touchent pas. */
export const needsSession = (pathname: string) => isAppPath(pathname) || SESSION_AUTH_PATHS.has(pathname);

export type AuthRedirect = { pathname: string; search: string };

/** Décide d'une éventuelle redirection selon la page demandée et l'état de connexion. */
export function authRedirect(pathname: string, search: string, isAuthenticated: boolean): AuthRedirect | null {
  if (isAppPath(pathname) && !isAuthenticated) {
    return { pathname: "/connexion", search: `?next=${encodeURIComponent(pathname + search)}` };
  }
  if (GUEST_ONLY_PATHS.has(pathname) && isAuthenticated) {
    return { pathname: DEFAULT_AUTHENTICATED_PATH, search: "" };
  }
  // Le lien de réinitialisation ouvre une session de récupération : sans elle, on redemande un lien.
  if (pathname === "/reinitialiser" && !isAuthenticated) {
    return { pathname: "/mot-de-passe-oublie", search: "" };
  }
  return null;
}
