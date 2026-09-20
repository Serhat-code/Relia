import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { JournalView } from "@/components/audit/JournalView";
import { journalCategory } from "@/lib/audit/categories";
import { JOURNAL_PAGE_SIZE, listJournal } from "@/lib/data/audit";
import { firstValue, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Journal" };

const MAX_PAGE = 10_000;

export default async function JournalPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const category = journalCategory(firstValue(params.theme));
  const requested = Number.parseInt(firstValue(params.page), 10);
  const page = Number.isInteger(requested) && requested >= 1 ? Math.min(requested, MAX_PAGE) : 1;
  const journal = await listJournal(category, page);

  return (
    <>
      <PageHeader
        title="Journal"
        description="Chaque action, automatique ou faite par un membre de votre équipe, tracée et datée : qui, quoi, quand, sur quelle facture."
      />
      <JournalView category={category} page={page} journal={journal} pageSize={JOURNAL_PAGE_SIZE} basePath="/app/journal" />
    </>
  );
}
