import { Lock } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { Pagination } from "@/components/ui/Pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { JOURNAL_CATEGORIES, type JournalCategory } from "@/lib/audit/categories";
import type { JournalPage } from "@/lib/data/audit";
import { formatDateTime } from "@/lib/format";

type JournalViewProps = {
  category: JournalCategory;
  page: number;
  journal: JournalPage;
  pageSize: number;
  basePath: string;
};

function hrefFor(basePath: string, slug: string, page = 1): string {
  const params = new URLSearchParams();
  if (slug !== "tout") params.set("theme", slug);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Journal d'audit (§5.8) : chaque action, automatique ou d'un membre, datée et attribuée. */
export function JournalView({ category, page, journal, pageSize, basePath }: JournalViewProps) {
  const tabs = JOURNAL_CATEGORIES.map((item) => ({
    label: item.label,
    href: hrefFor(basePath, item.slug),
    isActive: item.slug === category.slug,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Reveal index={1}>
        <LinkTabs tabs={tabs} label="Filtrer le journal" />
      </Reveal>
      {journal.entries.length === 0 ? (
        <Reveal index={2}>
          <EmptyState
            title="Aucun événement"
            description="Les actions de Relia et de votre équipe s'inscrivent ici au fur et à mesure : imports, relances, réponses, changements de statut."
          />
        </Reveal>
      ) : (
        <Reveal index={2}>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Date</TableHead>
                  <TableHead>Événement</TableHead>
                  <TableHead className="w-48">Auteur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journal.entries.map((entry, index) => (
                  <TableRow key={entry.id} index={index}>
                    <TableCell className="text-fg-muted tabular-nums whitespace-nowrap">
                      <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                    </TableCell>
                    <TableCell>
                      <span className="text-fg">{entry.description}</span>
                      {entry.link && (
                        <Link href={entry.link.href} className="ml-2 text-xs font-medium whitespace-nowrap text-link hover:underline">
                          {entry.link.label}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-fg-muted">{entry.actor}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Reveal>
      )}
      {journal.pageCount > 1 && (
        <Pagination
          page={page}
          pageCount={journal.pageCount}
          total={journal.total}
          pageSize={pageSize}
          hrefForPage={(target) => hrefFor(basePath, category.slug, target)}
        />
      )}
      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <Lock aria-hidden className="size-3.5 shrink-0" />
        Journal inaltérable : personne ne peut modifier ni effacer une entrée, pas même Relia. Il est purgé seulement au terme
        de la durée de conservation choisie pour votre organisation.
      </p>
    </div>
  );
}
