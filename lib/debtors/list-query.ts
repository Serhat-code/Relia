import { firstValue, sanitizeSearch, type SearchParams } from "@/lib/search-params";
import type { ClientType } from "./client-type";

/** Onglets de la liste des débiteurs : tous, professionnels, particuliers (§2.5). */
export type DebtorFilter = "all" | ClientType;

export const DEBTOR_FILTERS: Readonly<Record<DebtorFilter, { slug: string; label: string }>> = {
  all: { slug: "tous", label: "Tous" },
  b2b: { slug: "professionnels", label: "Professionnels" },
  b2c: { slug: "particuliers", label: "Particuliers" },
};

export const DEBTORS_PAGE_SIZE = 25;
const MAX_PAGE = 10_000;

export type DebtorListQuery = { filter: DebtorFilter; search: string; page: number };

export function parseDebtorListQuery(params: SearchParams): DebtorListQuery {
  const slug = firstValue(params.type);
  const filter = (Object.keys(DEBTOR_FILTERS) as DebtorFilter[]).find((key) => DEBTOR_FILTERS[key].slug === slug);
  const page = Number.parseInt(firstValue(params.page), 10);
  return {
    filter: filter ?? "all",
    search: sanitizeSearch(firstValue(params.q)),
    page: Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
  };
}

export function debtorListHref({ filter, search, page }: DebtorListQuery): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("type", DEBTOR_FILTERS[filter].slug);
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/app/debiteurs?${query}` : "/app/debiteurs";
}
