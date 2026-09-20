import ipaddr from "ipaddr.js";

/**
 * Les serveurs SMTP et IMAP sont saisis par le client : sans garde, Relia pourrait être amenée à se connecter à
 * une machine de son propre réseau (SSRF). On n'accepte que les ports de messagerie et les adresses
 * publiques routables — en liste blanche : seule la plage « unicast » d'ipaddr.js est admise, ce qui
 * écarte boucle locale, réseaux privés, lien local, NAT d'opérateur, plages de documentation, et en
 * IPv6 les formes qui encapsulent une adresse IPv4 (::a.b.c.d, ::ffff:a.b.c.d, NAT64, 6to4, Teredo).
 */

export { ALLOWED_SMTP_PORTS, isAllowedSmtpPort } from "./smtp-ports";

export function isPublicAddress(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return false;
  return ipaddr.parse(ip).range() === "unicast";
}

/**
 * Résout le serveur et renvoie une adresse publique à laquelle se connecter. Toutes les adresses
 * doivent être publiques : un nom qui pointe aussi vers le réseau interne est refusé. On se
 * connecte ensuite à l'adresse résolue (et non au nom), pour qu'une seconde résolution ne puisse
 * pas mener ailleurs.
 */
export async function resolvePublicMailHost(host: string): Promise<string | null> {
  if (ipaddr.isValid(host)) return isPublicAddress(host) ? host : null;
  const { lookup } = await import("node:dns/promises");
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some((entry) => !isPublicAddress(entry.address))) return null;
    return addresses[0]?.address ?? null;
  } catch {
    return null;
  }
}
