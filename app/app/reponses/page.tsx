import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { ReplyCard } from "@/components/replies/ReplyCard";
import { CheckRepliesButton } from "@/components/replies/ReplyControls";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/FormMessage";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { getMailbox, type Mailbox } from "@/lib/data/mailbox";
import { countRepliesByFilter, listReplies, type ReplyFilter } from "@/lib/data/replies";
import { todayInParis } from "@/lib/invoices/dates";
import { firstValue, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Réponses" };

const FILTERS: ReadonlyArray<{ filter: ReplyFilter; slug: string; label: string; empty: string; description: string }> = [
  {
    filter: "new",
    slug: "a-traiter",
    label: "À traiter",
    empty: "Aucune réponse n'attend votre décision.",
    description: "Quand un client répond à une relance, sa réponse arrive ici et les relances de la facture sont mises en pause.",
  },
  {
    filter: "handled",
    slug: "traitees",
    label: "Traitées",
    empty: "Aucune réponse traitée pour l'instant.",
    description: "Les promesses détectées, les réponses classées et les messages d'absence apparaissent ici.",
  },
];

/** État de la lecture de la boîte, dit en clair (les réponses ne sont lues que si la boîte le permet). */
function readingNotice(mailbox: Mailbox | null): ReactNode {
  const link = (
    <Link href="/app/boite-mail" className="font-medium text-link hover:underline">
      Boîte d&apos;envoi
    </Link>
  );
  if (!mailbox) {
    return <FormMessage tone="info">Aucune boîte n&apos;est connectée : Relia ne peut pas lire les réponses de vos clients. {link}</FormMessage>;
  }
  if (mailbox.provider === "smtp" && !mailbox.imapHost) {
    return (
      <FormMessage tone="info">
        Relia ne lit pas les réponses de cette boîte SMTP : indiquez son serveur IMAP pour qu&apos;une réponse suspende les
        relances. {link}
      </FormMessage>
    );
  }
  if (mailbox.repliesError) {
    return (
      <FormMessage tone="error">
        Lecture des réponses impossible : {mailbox.repliesError} {link}
      </FormMessage>
    );
  }
  return null;
}

export default async function RepliesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const slug = firstValue((await searchParams).statut);
  const current = FILTERS.find((item) => item.slug === slug) ?? FILTERS[0];
  if (!current) return null;
  const [replies, counts, mailbox] = await Promise.all([listReplies(current.filter), countRepliesByFilter(), getMailbox()]);
  const today = todayInParis();
  const notice = readingNotice(mailbox);
  const tabs = FILTERS.map((item) => ({
    label: item.label,
    href: item.filter === "new" ? "/app/reponses" : `/app/reponses?statut=${item.slug}`,
    count: counts[item.filter],
    isActive: item.filter === current.filter,
  }));

  return (
    <>
      <PageHeader
        title="Réponses"
        description="Les réponses de vos clients à vos relances, lues dans votre boîte toutes les 30 minutes. Une réponse suspend les relances de la facture jusqu'à votre décision."
        actions={<CheckRepliesButton />}
      />
      <div className="flex flex-col gap-6">
        {notice && <Reveal index={1}>{notice}</Reveal>}
        <Reveal index={1}>
          <LinkTabs tabs={tabs} label="Filtrer les réponses" />
        </Reveal>
        {replies.length === 0 ? (
          <Reveal index={2}>
            <EmptyState title={current.empty} description={current.description} />
          </Reveal>
        ) : (
          <div className="flex flex-col gap-4">
            {replies.map((reply, index) => (
              <Reveal key={reply.id} index={Math.min(index + 2, 8)}>
                <ReplyCard reply={reply} today={today} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
