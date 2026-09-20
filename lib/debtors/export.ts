/** Nom du fichier d'export des données d'un débiteur : ASCII, sans espace ni caractère réservé. */
export function exportFileName(debtorName: string, date: string): string {
  const slug = debtorName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `relia-client-${slug || "sans-nom"}-${date}.json`;
}
