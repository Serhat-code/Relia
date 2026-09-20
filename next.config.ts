import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/**
 * Un import de 2 000 factures (lignes déjà lues dans le navigateur) pèse environ 1 Mo :
 * marge au-dessus, en restant sous la limite de corps de requête de Vercel (4,5 Mo).
 */
const SERVER_ACTION_BODY_LIMIT = "3mb";

/**
 * `next dev` écrit dans .next-dev, `next build` dans .next : un build de production
 * lancé pendant que le serveur de développement tourne vidait .next sous ses pieds
 * (ENOENT sur _buildManifest.js.tmp et build-manifest.json).
 *
 * Pas de typedRoutes : chaque dossier générerait ses propres types de liens, et les deux
 * jeux (dev et build) entreraient en conflit dans tsconfig.
 */
/**
 * En-têtes de sécurité de base. La politique de sécurité du contenu (CSP, avec nonce) viendra
 * au palier 15, une fois connus tous les domaines tiers (Stripe, fournisseurs OAuth).
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

export default function nextConfig(phase: string): NextConfig {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    reactStrictMode: true,
    poweredByHeader: false,
    headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
    experimental: { serverActions: { bodySizeLimit: SERVER_ACTION_BODY_LIMIT } },
  };
}
