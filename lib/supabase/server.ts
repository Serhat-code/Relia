import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Client Supabase côté serveur, au nom de l'utilisateur connecté : la RLS s'applique.
 * À utiliser dans les Server Components, Server Actions et Route Handlers (couche lib/data).
 */
export async function createSupabaseServerClient() {
  // cookies() en premier : la page est ainsi reconnue comme dynamique (jamais pré-rendue au build).
  const cookieStore = await cookies();
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appel depuis un Server Component, qui ne peut pas écrire de cookie : sans conséquence,
          // le middleware rafraîchit la session à chaque requête.
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
