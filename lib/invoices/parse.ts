/**
 * Lecture des montants et des dates tels qu'ils apparaissent dans les exports comptables
 * français (virgule décimale, espaces de milliers, JJ/MM/AAAA) ou internationaux.
 */

/** Un séparateur répété ne peut que grouper des milliers : 1.234.567 ou 1,234,567. */
const THOUSANDS_GROUPS = { ",": /^\d{1,3}(,\d{3})+$/, ".": /^\d{1,3}(\.\d{3})+$/ } as const;

/**
 * Montant positif arrondi au centime, ou null si la valeur est illisible. Avec les deux séparateurs,
 * le dernier est décimal. Avec un seul, suivi d'exactement trois chiffres (« 1.234 », « 12,500 »), c'est
 * un séparateur de milliers : aucun montant ne s'écrit avec trois décimales.
 */
export function parseAmount(raw: string): number | null {
  // \s couvre aussi les espaces insécables utilisées comme séparateur de milliers.
  const cleaned = raw.replace(/\s/g, "").replace(/€|EUR/gi, "");
  if (!/^\d[\d.,]*$/.test(cleaned)) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized: string;
  if (hasComma && hasDot) {
    const decimal = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    normalized = cleaned.split(thousands).join("").replace(decimal, ".");
  } else if (hasComma || hasDot) {
    const separator = hasComma ? "," : ".";
    const count = cleaned.split(separator).length - 1;
    if (THOUSANDS_GROUPS[separator].test(cleaned) && (count > 1 || /^[1-9]/.test(cleaned))) {
      normalized = cleaned.split(separator).join("");
    } else if (count === 1) {
      normalized = cleaned.replace(separator, ".");
    } else {
      return null;
    }
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

const isRealDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const pad = (value: number) => String(value).padStart(2, "0");

/** Date ISO (AAAA-MM-JJ) depuis JJ/MM/AAAA, JJ-MM-AA, AAAA-MM-JJ…, ou null si invalide. */
export function parseDate(raw: string): string | null {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(value);
  const french = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(value);

  let parts: [number, number, number] | null = null;
  if (iso) parts = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (french) {
    const year = Number(french[3]);
    parts = [year < 100 ? 2000 + year : year, Number(french[2]), Number(french[1])];
  }
  if (!parts) return null;

  const [year, month, day] = parts;
  return isRealDate(year, month, day) ? `${year}-${pad(month)}-${pad(day)}` : null;
}

/**
 * Montant lu comme des milliers mais qui pourrait être un décimal à trois chiffres (« 1.234 »,
 * « 156,780 ») : l'assistant d'import demande de le vérifier avant d'importer.
 */
export function isAmbiguousAmount(raw: string): boolean {
  const cleaned = raw.replace(/\s/g, "").replace(/€|EUR/gi, "");
  return /^[1-9]\d{0,2}[.,]\d{3}$/.test(cleaned);
}
