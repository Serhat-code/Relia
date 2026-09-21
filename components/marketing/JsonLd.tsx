import { headers } from "next/headers";
import type { JsonLdObject } from "@/lib/marketing/structured-data";

/**
 * Données structurées schema.org. Le nonce de la requête est repris : la CSP du projet n'autorise
 * aucun script sans lui, et même si `application/ld+json` n'est pas exécuté, certains navigateurs
 * appliquent `script-src` à tout élément `<script>`.
 *
 * `<` est échappé dans le JSON : sans cela, une chaîne contenant `</script>` fermerait la balise.
 * Les données viennent du dépôt et non d'un utilisateur, mais la règle ne coûte rien.
 */
export async function JsonLd({ data }: { data: JsonLdObject }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: json }} />;
}
