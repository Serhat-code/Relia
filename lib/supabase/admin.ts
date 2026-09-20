import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Client Supabase avec la clé secrète : contourne la RLS. Réservé aux opérations que
 * l'utilisateur ne peut pas faire lui-même (provisionnement à l'inscription, crons, secrets).
 * Jamais importé par un composant client (server-only le garantit au build).
 */
export function createSupabaseAdminClient() {
  const { supabaseUrl } = getPublicEnv();
  const { supabaseSecretKey } = getServerEnv();

  return createClient<Database>(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
