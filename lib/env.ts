import { z } from "zod";

/** Vrai uniquement sur le déploiement de production Vercel (pas en préversion ni en local). */
export function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === "production";
}

const HELP = "Copiez .env.example vers .env.local et renseignez les valeurs de votre projet Supabase.";

// Les chaînes vides valent « non renseigné ».
const emptyAsUndefined = (value: unknown) => (value === "" ? undefined : value);

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(emptyAsUndefined, z.url()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.preprocess(emptyAsUndefined, z.string().min(1)),
  NEXT_PUBLIC_SITE_URL: z.preprocess(emptyAsUndefined, z.url().optional()),
});

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.preprocess(emptyAsUndefined, z.string().min(1)),
});

function describeMissing(error: z.ZodError): string {
  const names = error.issues.map((issue) => issue.path.join(".")).join(", ");
  return `Configuration manquante ou invalide : ${names}. ${HELP}`;
}

const LOCAL_SITE_URL = "http://localhost:3000";

/**
 * URL des liens envoyés par e-mail. Sur une préversion Vercel sans URL déclarée : l'adresse de la
 * branche (variable système VERCEL_BRANCH_URL, lue côté serveur), sinon le serveur local.
 */
function fallbackSiteUrl(): string {
  // En production, un repli vers localhost fausserait liens d'e-mail, retours OAuth et cookies « Secure ».
  if (isProductionDeployment()) throw new Error(`Configuration manquante : NEXT_PUBLIC_SITE_URL. ${HELP}`);
  const branchUrl = process.env.VERCEL_BRANCH_URL;
  return process.env.VERCEL_ENV === "preview" && branchUrl ? `https://${branchUrl}` : LOCAL_SITE_URL;
}

export type PublicEnv = { supabaseUrl: string; supabasePublishableKey: string; siteUrl: string };

// Références littérales à process.env.NEXT_PUBLIC_* : Next.js ne les injecte qu'ainsi.
export function getPublicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (!parsed.success) throw new Error(describeMissing(parsed.error));
  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    siteUrl: parsed.data.NEXT_PUBLIC_SITE_URL ?? fallbackSiteUrl(),
  };
}

/** Clé secrète Supabase (contourne la RLS) : à n'utiliser que côté serveur. */
export function getServerEnv(): { supabaseSecretKey: string } {
  const parsed = serverSchema.safeParse({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY });
  if (!parsed.success) throw new Error(describeMissing(parsed.error));
  return { supabaseSecretKey: parsed.data.SUPABASE_SECRET_KEY };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export type OAuthClient = { clientId: string; clientSecret: string };

/**
 * Application OAuth de Relia auprès de Google ou Microsoft (connexion de la boîte d'envoi du client).
 * Null si elle n'est pas configurée : la connexion correspondante est alors indisponible.
 */
export function getOAuthClient(provider: "google" | "microsoft"): OAuthClient | null {
  const clientId = provider === "google" ? process.env.GOOGLE_OAUTH_CLIENT_ID : process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret =
    provider === "google" ? process.env.GOOGLE_OAUTH_CLIENT_SECRET : process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}
