import { z } from "zod";

const ipAddress = z.union([z.ipv4(), z.ipv6()]);

/** Adresse inconnue : valeur non routable, explicite dans les preuves d'acceptation du DPA. */
export const UNKNOWN_IP = "0.0.0.0";

/**
 * Sources de l'adresse du client, de la plus fiable à la moins fiable. Sur Vercel,
 * x-vercel-forwarded-for et x-real-ip sont posés par la plateforme : le client ne peut pas
 * les forger. x-forwarded-for ne sert qu'en dernier recours (hors Vercel).
 */
const IP_HEADERS = ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"] as const;

/** Adresse IP du client, conservée comme preuve d'acceptation du DPA (§2.2). */
export function clientIp(headers: Headers): string {
  for (const name of IP_HEADERS) {
    const candidate = headers.get(name)?.split(",")[0]?.trim();
    if (candidate && ipAddress.safeParse(candidate).success) return candidate;
  }
  return UNKNOWN_IP;
}
