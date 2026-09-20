import type { InvoiceStatus } from "./status";

/** Onglets de la liste des factures ; « à encaisser » regroupe tout ce qui reste dû. */
export type InvoiceFilter = "open" | "late" | "promised" | "disputed" | "paid" | "cancelled" | "all";

type FilterDefinition = { slug: string; label: string; statuses: readonly InvoiceStatus[] | null };

export const INVOICE_FILTERS: Readonly<Record<InvoiceFilter, FilterDefinition>> = {
  open: { slug: "a-encaisser", label: "À encaisser", statuses: ["pending", "late", "promised"] },
  late: { slug: "en-retard", label: "En retard", statuses: ["late"] },
  promised: { slug: "promesses", label: "Promesses", statuses: ["promised"] },
  disputed: { slug: "litiges", label: "Litiges", statuses: ["disputed"] },
  paid: { slug: "payees", label: "Payées", statuses: ["paid"] },
  cancelled: { slug: "annulees", label: "Annulées", statuses: ["cancelled"] },
  all: { slug: "toutes", label: "Toutes", statuses: null },
};

export const DEFAULT_FILTER: InvoiceFilter = "open";
export const INVOICES_PAGE_SIZE = 25;
const MAX_SEARCH_LENGTH = 100;
const MAX_PAGE = 10_000;

export type InvoiceListQuery = { filter: InvoiceFilter; search: string; page: number };

type SearchParams = Record<string, string | string[] | undefined>;

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/**
 * Recherche utilisable dans un filtre de l'API (valeur citée entre guillemets) : virgules, parenthèses,
 * guillemets, jokers et barres obliques inverses y ont un sens, on les retire.
 */
export function sanitizeSearch(raw: string): string {
  return raw
    .replace(/[,()"*%\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}

/** Paramètres d'URL de la liste ; une valeur inconnue retombe sur la valeur par défaut. */
export function parseListQuery(params: SearchParams): InvoiceListQuery {
  const slug = firstValue(params.statut);
  const filter = (Object.keys(INVOICE_FILTERS) as InvoiceFilter[]).find((key) => INVOICE_FILTERS[key].slug === slug);
  const page = Number.parseInt(firstValue(params.page), 10);

  return {
    filter: filter ?? DEFAULT_FILTER,
    search: sanitizeSearch(firstValue(params.q)),
    page: Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
  };
}

/** URL de la liste pour une requête donnée (onglets, pagination) ; les valeurs par défaut sont omises. */
export function listHref({ filter, search, page }: InvoiceListQuery): string {
  const params = new URLSearchParams();
  if (filter !== DEFAULT_FILTER) params.set("statut", INVOICE_FILTERS[filter].slug);
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/app/factures?${query}` : "/app/factures";
}
