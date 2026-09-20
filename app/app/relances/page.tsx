import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { AutoSendToggle, PlanNowButton } from "@/components/reminders/QueueControls";
import { ReminderCard } from "@/components/reminders/ReminderCard";
import { buttonClasses } from "@/components/ui/button-styles";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/FormMessage";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { getMailbox } from "@/lib/data/mailbox";
import { countRemindersByFilter, listReminders, type ReminderFilter } from "@/lib/data/reminders";
import { requireMember } from "@/lib/data/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { firstValue, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Relances" };

const FILTERS: ReadonlyArray<{ filter: ReminderFilter; slug: string; label: string; empty: string }> = [
  { filter: "awaiting", slug: "a-valider", label: "À valider", empty: "Aucune relance n'attend votre validation." },
  { filter: "scheduled", slug: "planifiees", label: "Planifiées", empty: "Aucune relance planifiée." },
  { filter: "sent", slug: "envoyees", label: "Envoyées", empty: "Aucune relance envoyée pour l'instant." },
  { filter: "failed", slug: "echecs", label: "Échecs", empty: "Aucun envoi en échec." },
];

async function isAutoSendEnabled(organizationId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("organizations").select("auto_send").eq("id", organizationId).single();
  return data?.auto_send ?? false;
}

export default async function RemindersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const slug = firstValue((await searchParams).statut);
  const current = FILTERS.find((item) => item.slug === slug) ?? FILTERS[0];
  if (!current) return null;
  const member = await requireMember();
  const [reminders, counts, mailbox, autoSend] = await Promise.all([
    listReminders(current.filter),
    countRemindersByFilter(),
    getMailbox(),
    isAutoSendEnabled(member.organization.id),
  ]);
  const senderName = mailbox?.displayName ?? member.organization.name;
  const tabs = FILTERS.map((item) => ({
    label: item.label,
    href: item.filter === "awaiting" ? "/app/relances" : `/app/relances?statut=${item.slug}`,
    count: counts[item.filter],
    isActive: item.filter === current.filter,
  }));

  return (
    <>
      <PageHeader
        title="Relances"
        description="Les relances préparées selon vos scénarios. Elles partent de votre boîte, à votre nom."
        actions={<PlanNowButton />}
      />
      <div className="flex flex-col gap-6">
        {!mailbox && (
          <Reveal index={1}>
            <FormMessage tone="info">
              Aucune boîte d&apos;envoi n&apos;est connectée : les relances ne peuvent pas partir.{" "}
              <Link href="/app/boite-mail" className="font-medium text-link hover:underline">
                Connecter ma boîte
              </Link>
            </FormMessage>
          </Reveal>
        )}
        <Reveal index={1} className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <LinkTabs tabs={tabs} label="Filtrer les relances" />
          <div className="lg:max-w-md">
            <AutoSendToggle isEnabled={autoSend} canManage={member.role !== "member"} />
          </div>
        </Reveal>
        {reminders.length === 0 ? (
          <Reveal index={2}>
            <EmptyState
              title={current.empty}
              description="Relia prépare chaque matin les relances du jour, d'après l'échéance des factures et vos scénarios."
              actions={
                <Link href="/app/scenarios" className={buttonClasses({ variant: "secondary" })}>
                  Voir les scénarios
                </Link>
              }
            />
          </Reveal>
        ) : (
          <div className="flex flex-col gap-4">
            {reminders.map((reminder, index) => (
              <Reveal key={reminder.id} index={Math.min(index + 2, 8)}>
                <ReminderCard reminder={reminder} senderName={senderName} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
