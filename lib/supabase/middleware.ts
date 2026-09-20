import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Rafraîchit la session Supabase (cookies) à chaque requête et indique si l'utilisateur est
 * connecté. getClaims() vérifie la signature du jeton, contrairement à getSession().
 */
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; isAuthenticated: boolean }> {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([header, value]) => response.headers.set(header, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  return { response, isAuthenticated: Boolean(data?.claims.sub) };
}
