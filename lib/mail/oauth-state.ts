import { z } from "zod";

/**
 * État d'une connexion OAuth en cours, gardé dans un cookie httpOnly le temps de l'aller-retour
 * chez Google ou Microsoft : `state` (contre la falsification du retour), vérificateur PKCE,
 * fournisseur et membre (le retour doit revenir au même membre).
 */

export const OAUTH_STATE_COOKIE = "relia_oauth_state";
export const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

const stateSchema = z.object({
  state: z.string().min(1),
  verifier: z.string().min(1),
  provider: z.enum(["google", "microsoft"]),
  userId: z.uuid(),
});

export type OAuthState = z.infer<typeof stateSchema>;

export const serializeOAuthStateCookie = (state: OAuthState) => JSON.stringify(state);

export function parseOAuthStateCookie(value: string | undefined): OAuthState | null {
  if (!value) return null;
  try {
    const parsed = stateSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
