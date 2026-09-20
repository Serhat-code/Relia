import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { SequenceTimeline } from "@/components/sequences/SequenceTimeline";
import { ToneBadge } from "@/components/templates/ToneBadge";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { listSequences } from "@/lib/data/sequences";
import type { ClientType } from "@/lib/debtors/client-type";
import { describeOffset } from "@/lib/sequences/steps";

export const metadata: Metadata = { title: "Scénarios" };

const DESCRIPTIONS: Readonly<Record<ClientType, string>> = {
  b2b: "Appliqué aux factures de vos clients professionnels.",
  b2c: "Appliqué aux factures de vos clients particuliers : un rythme plus espacé.",
};

export default async function SequencesPage() {
  const sequences = await listSequences();

  return (
    <>
      <PageHeader
        title="Scénarios"
        description="Quand et sur quel ton vos clients sont relancés, en jours avant ou après l'échéance de chaque facture."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {sequences.map((sequence, index) => (
          <Reveal key={sequence.id} index={index + 1}>
            <Card className="flex h-full flex-col">
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <CardTitle>{sequence.name}</CardTitle>
                  <CardDescription>{DESCRIPTIONS[sequence.clientType]}</CardDescription>
                </div>
                <Link href={`/app/scenarios/${sequence.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                  <Pencil aria-hidden />
                  Modifier
                </Link>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <SequenceTimeline
                  steps={sequence.steps.map((step) => ({ key: step.id, offsetDays: step.offsetDays, tone: step.tone }))}
                />
                <ol className="flex flex-col divide-y divide-border">
                  {sequence.steps.map((step) => (
                    <li key={step.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                      <span className="text-fg">{describeOffset(step.offsetDays)}</span>
                      <span className="flex items-center gap-3">
                        <span className="hidden text-xs text-fg-muted sm:inline">{step.templateName ?? "Modèle Relia"}</span>
                        <ToneBadge tone={step.tone} />
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
    </>
  );
}
