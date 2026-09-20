import { NextResponse, type NextRequest } from "next/server";
import { authRedirect, needsSession } from "@/lib/auth/routes";
import { isSupabaseConfigured } from "@/lib/env";
import { buildContentSecurityPolicy, generateNonce } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Runtime Node.js : le middleware s'exécute dans la région des fonctions (cdg1) et non sur le réseau
 * Edge mondial — aucune donnée de session traitée hors UE (CLAUDE.md §2.2).
 *
 * Sur toutes les pages : politique de sécurité du contenu avec un nonce propre à la requête (transmis à
 * Next.js et au gabarit par les en-têtes de la requête). Sur l'espace client et l'authentification
 * seulement : rafraîchissement de la session et redirections.
 */
export const config = {
  runtime: "nodejs",
  matcher: [
    {
      // Hors fichiers statiques et préchargements (ils ne produisent pas de HTML).
      source: "/((?!_next/static|_next/image|icon|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

function withSecurityPolicy(response: NextResponse, policy: string): NextResponse {
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export async function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const policy = buildContentSecurityPolicy({ nonce, isDevelopment: process.env.NODE_ENV === "development" });
  // Next.js lit la politique dans les en-têtes de la requête et pose le nonce sur ses scripts.
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", policy);

  // Sans configuration Supabase, les pages affichent elles-mêmes l'erreur explicite.
  if (!needsSession(request.nextUrl.pathname) || !isSupabaseConfigured()) {
    return withSecurityPolicy(NextResponse.next({ request }), policy);
  }

  const { response, isAuthenticated } = await updateSession(request);
  const target = authRedirect(request.nextUrl.pathname, request.nextUrl.search, isAuthenticated);
  if (!target) return withSecurityPolicy(response, policy);

  const url = request.nextUrl.clone();
  url.pathname = target.pathname;
  url.search = target.search;
  const redirect = NextResponse.redirect(url);
  // La session éventuellement rafraîchie doit suivre la redirection.
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
