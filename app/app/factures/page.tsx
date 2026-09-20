import { FilePlus2, Search, Upload } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { Reveal } from "@/components/motion/Reveal";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { Pagination } from "@/components/ui/Pagination";
import { listInvoices } from "@/lib/data/invoices";
import { todayInParis } from "@/lib/invoices/dates";
import {
  DEFAULT_FILTER,
  INVOICE_FILTERS,
  INVOICES_PAGE_SIZE,
  listHref,
  parseListQuery,
  type InvoiceFilter,
} from "@/lib/invoices/list-query";

export const metadata: Metadata = { title: "Factures" };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function HeaderActions() {
  return (
    <>
      <Link href="/app/factures/importer" className={buttonClasses({ variant: "secondary" })}>
        <Upload aria-hidden />
        Importer
      </Link>
      <Link href="/app/factures/nouvelle" className={buttonClasses()}>
        <FilePlus2 aria-hidden />
        Nouvelle facture
      </Link>
    </>
  );
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const query = parseListQuery(await searchParams);
  const list = await listInvoices(query);
  const today = todayInParis();

  if (list.counts.all === 0) {
    return (
      <>
        <PageHeader title="Factures" description="Toutes vos factures, leur échéance et leur statut." />
        <Reveal index={1}>
          <EmptyState
            title="Aucune facture pour l'instant"
            description="Importez l'export CSV de votre logiciel de facturation, déposez des factures électroniques, ou saisissez une facture à la main."
            actions={<HeaderActions />}
          />
        </Reveal>
      </>
    );
  }

  const tabs = (Object.keys(INVOICE_FILTERS) as InvoiceFilter[]).map((filter) => ({
    label: INVOICE_FILTERS[filter].label,
    href: listHref({ filter, search: query.search, page: 1 }),
    count: list.counts[filter],
    isActive: filter === query.filter,
  }));
  const filterLabel = INVOICE_FILTERS[query.filter].label.toLowerCase();
  const emptyMessage = query.search
    ? `Aucune facture ne correspond à « ${query.search} ».`
    : `Aucune facture dans « ${filterLabel} ».`;

  return (
    <>
      <PageHeader
        title="Factures"
        description="Toutes vos factures, leur échéance et leur statut."
        actions={<HeaderActions />}
      />
      <Reveal index={1}>
        <Card className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <LinkTabs tabs={tabs} label="Filtrer par statut" />
            <Form action="/app/factures" className="relative w-full lg:w-72" role="search">
              {query.filter !== DEFAULT_FILTER && (
                <input type="hidden" name="statut" value={INVOICE_FILTERS[query.filter].slug} />
              )}
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
              />
              <input
                key={query.search}
                type="search"
                name="q"
                defaultValue={query.search}
                placeholder="Numéro ou client"
                aria-label="Rechercher une facture par numéro ou par client"
                className="h-10 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-sm text-fg placeholder:text-fg-muted transition duration-hover ease-standard hover:border-glow focus:border-accent focus:ring-3 focus:ring-accent/25 focus-visible:outline-none"
              />
            </Form>
          </div>
          <InvoiceTable invoices={list.items} today={today} emptyMessage={emptyMessage} />
          {list.total > INVOICES_PAGE_SIZE && (
            <Pagination
              page={query.page}
              pageCount={list.pageCount}
              total={list.total}
              pageSize={INVOICES_PAGE_SIZE}
              hrefForPage={(page) => listHref({ ...query, page })}
            />
          )}
        </Card>
      </Reveal>
    </>
  );
}
