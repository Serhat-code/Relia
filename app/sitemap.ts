import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Pages publiques indexables (l'application et les démonstrations ne le sont pas). */
const PUBLIC_PAGES = [
  { path: "/", priority: 1 },
  { path: "/tarifs", priority: 0.9 },
  { path: "/inscription", priority: 0.7 },
  { path: "/sous-traitants", priority: 0.4 },
  { path: "/dpa", priority: 0.4 },
  { path: "/confidentialite", priority: 0.3 },
  { path: "/cgu", priority: 0.3 },
  { path: "/mentions-legales", priority: 0.2 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((page) => ({ url: `${SITE_URL}${page.path}`, changeFrequency: "monthly", priority: page.priority }));
}
