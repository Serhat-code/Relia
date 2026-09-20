import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { ToneBadge } from "@/components/templates/ToneBadge";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { listTemplates, type TemplateItem } from "@/lib/data/templates";
import type { ClientType } from "@/lib/debtors/client-type";
import { pluralize } from "@/lib/format";
import { firstValue, type SearchParams } from "@/lib/search-params";
import { REMINDER_TONE_LABELS, type ReminderTone } from "@/lib/templates/system-templates";

export const metadata: Metadata = { title: "Modèles" };

const TONES: readonly ReminderTone[] = ["courtois", "ferme", "mise_en_demeure"];

const TYPE_INTRO: Readonly<Record<ClientType, string>> = {
  b2b: "Pour les professionnels : les relances fermes peuvent rappeler l'indemnité forfaitaire de 40 € et les pénalités légales.",
  b2c: "Pour les particuliers : délais plus longs, ton plus mesuré, jamais de pénalités professionnelles.",
};

function TemplateCard({ template }: { template: TemplateItem }) {
  return (
    <Link href={`/app/modeles/${template.id}`} className="group block rounded-2xl focus-visible:outline-none">
      <Card
        isInteractive
        className="flex h-full flex-col gap-3 p-5 group-focus-visible:ring-3 group-focus-visible:ring-accent/40"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium text-fg">{template.name}</h3>
          {template.isSystem ? (
            <Badge>
              <Lock aria-hidden className="size-3" />
              Relia
            </Badge>
          ) : (
            <Badge tone="accent">Personnalisé</Badge>
          )}
        </div>
        <p className="line-clamp-1 text-sm text-fg-muted">{template.subject}</p>
        <p className="mt-auto text-xs text-fg-muted">
          {template.usageCount > 0
            ? `Utilisé par ${template.usageCount} ${pluralize(template.usageCount, "étape", "étapes")} de scénario`
            : "Non utilisé dans un scénario"}
        </p>
      </Card>
    </Link>
  );
}

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const clientType: ClientType = firstValue((await searchParams).type) === "particuliers" ? "b2c" : "b2b";
  const templates = await listTemplates(clientType);
  const tabs = [
    { label: "Professionnels", href: "/app/modeles", isActive: clientType === "b2b" },
    { label: "Particuliers", href: "/app/modeles?type=particuliers", isActive: clientType === "b2c" },
  ];

  return (
    <>
      <PageHeader
        title="Modèles"
        description="Les textes de vos relances. Les modèles Relia respectent les règles légales ; personnalisez-en une copie pour changer le ton."
      />
      <div className="flex flex-col gap-8">
        <Reveal index={1} className="flex flex-col gap-3">
          <LinkTabs tabs={tabs} label="Type de client" />
          <p className="text-sm text-fg-muted">{TYPE_INTRO[clientType]}</p>
        </Reveal>
        {TONES.map((tone, index) => {
          const group = templates.filter((template) => template.tone === tone);
          return (
            <Reveal key={tone} index={index + 2}>
              <section className="flex flex-col gap-3" aria-labelledby={`ton-${tone}`}>
                <h2 id={`ton-${tone}`} className="flex items-center gap-3 text-base font-semibold">
                  {REMINDER_TONE_LABELS[tone]}
                  <ToneBadge tone={tone} />
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((template) => (
                    <TemplateCard key={template.id} template={template} />
                  ))}
                </div>
              </section>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
