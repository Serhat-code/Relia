import "server-only";
import { getPublicEnv } from "@/lib/env";
import type { OAuthProvider } from "./oauth";

/** Chemin commun aux routes et au cookie d'état de la connexion OAuth. */
export const MAILBOX_PATH = "/app/boite-mail";

export const isOAuthProvider = (value: string): value is OAuthProvider => value === "google" || value === "microsoft";

/** URI de retour déclarée chez Google et Microsoft (voir .env.example). */
export const oauthRedirectUri = (provider: OAuthProvider) => `${getPublicEnv().siteUrl}${MAILBOX_PATH}/retour/${provider}`;

/** Cookie « Secure » dès que le site est servi en HTTPS (pas en développement local). */
export const isSecureSite = () => getPublicEnv().siteUrl.startsWith("https://");

/** Page de la boîte d'envoi avec un code d'erreur à afficher. */
export const mailboxErrorUrl = (code: string) => `${MAILBOX_PATH}?erreur=${encodeURIComponent(code)}`;
