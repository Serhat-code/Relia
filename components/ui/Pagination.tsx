import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button-styles";
import { formatNumber } from "@/lib/format";

type PaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  /** URL d'une page donnée (l'état vit dans l'URL). */
  hrefForPage: (page: number) => string;
};

function PageLink({ page, href, direction }: { page: number | null; href: string; direction: "previous" | "next" }) {
  const label = direction === "previous" ? "Page précédente" : "Page suivante";
  const icon =
    direction === "previous" ? <ChevronLeft aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />;
  const className = buttonClasses({ variant: "secondary", size: "sm", className: "w-8 px-0" });

  if (page === null) {
    return (
      <span aria-disabled="true" aria-label={label} className={`${className} pointer-events-none opacity-40`}>
        {icon}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={className}>
      {icon}
    </Link>
  );
}

export function Pagination({ page, pageCount, total, pageSize, hrefForPage }: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 text-sm text-fg-muted">
      <p className="tabular-nums">
        {formatNumber(first)}–{formatNumber(last)} sur {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        <PageLink direction="previous" page={page > 1 ? page - 1 : null} href={hrefForPage(page - 1)} />
        <span className="tabular-nums">
          Page {formatNumber(page)} / {formatNumber(pageCount)}
        </span>
        <PageLink direction="next" page={page < pageCount ? page + 1 : null} href={hrefForPage(page + 1)} />
      </div>
    </nav>
  );
}
