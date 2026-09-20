import { Search, Upload } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { DebtorTable } from "@/components/debtors/DebtorTable";
import { Reveal } from "@/components/motion/Reveal";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/FormMessage";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { Pagination } from "@/components/ui/Pagination";
import { listDebtors } from "@/lib/data/debtors";
import {
  DEBTOR_FILTERS,
  DEBTORS_PAGE_SIZE,
  debtorListHref,
  parseDebtorListQuery,
  type DebtorFilter,
} from "@/lib/debtors/list-query";
import type { SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Débiteurs" };

const DESCRIPTION = "Vos clients, ce qu'ils vous doivent et leur façon de régler.";

export default async function DebtorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = parseDebtorListQuery(params);
  const list = await listDebtors(query);
  const hasFilter = query.filter !== "all" || query.search !== "";
  const wasErased = params.efface === "1";

  if (list.total === 0 && !hasFilter) {
    return (
      <>
        <PageHeader title="Débiteurs" description={DESCRIPTION} />
        {wasErased && (
          <Reveal index={1} className="mb-6">
            <FormMessage tone="success">Client effacé, avec toutes ses données.</FormMessage>
          </Reveal>
        )}
        <Reveal index={1}>
          <EmptyState
            title="Aucun client pour l'instant"
            description="Vos clients apparaissent ici dès l'import de leurs factures : Relia les reconnaît par leur SIREN ou leur nom."
            actions={
              <Link href="/app/factures/importer" className={buttonClasses()}>
                <Upload aria-hidden />
                Importer des factures
              </Link>
            }
          />
        </Reveal>
      </>
    );
  }

  const tabs = (Object.keys(DEBTOR_FILTERS) as DebtorFilter[]).map((filter) => ({
    label: DEBTOR_FILTERS[filter].label,
    href: debtorListHref({ filter, search: query.search, page: 1 }),
    isActive: filter === query.filter,
  }));
  const emptyMessage = query.search
    ? `Aucun client ne correspond à « ${query.search} ».`
    : "Aucun client dans cette catégorie.";

  return (
    <>
      <PageHeader title="Débiteurs" description={DESCRIPTION} />
      {wasErased && (
        <Reveal index={1} className="mb-6">
          <FormMessage tone="success">Client effacé, avec toutes ses données.</FormMessage>
        </Reveal>
      )}
      <Reveal index={1}>
        <Card className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <LinkTabs tabs={tabs} label="Filtrer par type de client" />
            <Form action="/app/debiteurs" className="relative w-full lg:w-72" role="search">
              {query.filter !== "all" && <input type="hidden" name="type" value={DEBTOR_FILTERS[query.filter].slug} />}
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
              />
              <input
                key={query.search}
                type="search"
                name="q"
                defaultValue={query.search}
                placeholder="Nom, e-mail ou SIREN"
                aria-label="Rechercher un client par nom, e-mail ou SIREN"
                className="h-10 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-sm text-fg placeholder:text-fg-muted transition duration-hover ease-standard hover:border-glow focus:border-accent focus:ring-3 focus:ring-accent/25 focus-visible:outline-none"
              />
            </Form>
          </div>
          <DebtorTable debtors={list.items} emptyMessage={emptyMessage} />
          {list.total > DEBTORS_PAGE_SIZE && (
            <Pagination
              page={query.page}
              pageCount={list.pageCount}
              total={list.total}
              pageSize={DEBTORS_PAGE_SIZE}
              hrefForPage={(page) => debtorListHref({ ...query, page })}
            />
          )}
        </Card>
      </Reveal>
    </>
  );
}
