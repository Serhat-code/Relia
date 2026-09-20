/**
 * Formatage des montants et des dates pour l'interface.
 * Le fuseau est fixé à Paris : le rendu serveur (UTC sur Vercel) et le rendu
 * navigateur doivent produire la même chaîne, sinon l'hydratation échoue.
 *
 * Une valeur invalide s'affiche « — » : la validation des données se fait en amont
 * (Zod, aux frontières) ; l'affichage ne doit jamais faire planter une page.
 */
const LOCALE = "fr-FR";
const TIME_ZONE = "Europe/Paris";
const INVALID_VALUE = "—";

const currencyFormatters = new Map<string, Intl.NumberFormat>();

const amountFormatter = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function currencyFormatter(currency: string): Intl.NumberFormat | null {
  const cached = currencyFormatters.get(currency);
  if (cached) return cached;

  try {
    const formatter = new Intl.NumberFormat(LOCALE, { style: "currency", currency });
    currencyFormatters.set(currency, formatter);
    return formatter;
  } catch {
    // Code mal formé (donnée ancienne ou externe) : jamais de page en erreur pour un montant.
    return null;
  }
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  if (!Number.isFinite(amount)) return INVALID_VALUE;
  const formatter = currencyFormatter(currency);
  return formatter ? formatter.format(amount) : `${amountFormatter.format(amount)} ${currency}`;
}

const numberFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return INVALID_VALUE;
  return numberFormatter.format(value);
}

/** Durée en jours (DSO, retard moyen) : « 1 jour », « 52 jours ». */
export function formatDays(value: number): string {
  if (!Number.isFinite(value)) return INVALID_VALUE;
  const days = Math.round(value);
  return `${formatNumber(days)} ${Math.abs(days) >= 2 ? "jours" : "jour"}`;
}

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
});

export function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return INVALID_VALUE;
  return dateFormatter.format(date);
}

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

/** Horodatage du journal : « 18/09/2026 à 14:32 ». */
export function formatDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return INVALID_VALUE;
  const parts = Object.fromEntries(dateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year} à ${parts.hour}:${parts.minute}`;
}

/** Accord en nombre : singulier pour 0 et 1, pluriel à partir de 2 (usage français). */
export function pluralize(count: number, singular: string, plural: string): string {
  return Math.abs(count) >= 2 ? plural : singular;
}
