import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** L'espace client, l'API, les liens d'authentification et les démonstrations internes ne sont pas indexés. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/api", "/auth", "/design"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
