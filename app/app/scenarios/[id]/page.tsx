import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { StepEditor } from "@/components/sequences/StepEditor";
import { Card, CardContent } from "@/components/ui/Card";
import { getSequence } from "@/lib/data/sequences";
import { listTemplates } from "@/lib/data/templates";
import { CLIENT_TYPE_LABELS } from "@/lib/debtors/client-type";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const sequence = await getSequence((await params).id);
  return { title: sequence ? sequence.name : "Scénario introuvable" };
}

export default async function SequencePage({ params }: PageProps) {
  const sequence = await getSequence((await params).id);
  if (!sequence) notFound();
  const templates = await listTemplates(sequence.clientType);
  const systemIds = new Set(templates.filter((template) => template.isSystem).map((template) => template.id));

  return (
    <>
      <Link
        href="/app/scenarios"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors duration-hover hover:text-fg"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Scénarios
      </Link>
      <PageHeader
        title={sequence.name}
        description={`${CLIENT_TYPE_LABELS[sequence.clientType]}s · jusqu'à 8 étapes, du courtois à la mise en demeure factuelle. Un ton ferme ne s'utilise qu'après l'échéance.`}
      />
      <Reveal index={1}>
        <Card>
          <CardContent>
            <StepEditor
              sequenceId={sequence.id}
              // Le modèle Relia est le choix par défaut : l'éditeur le représente par « aucun modèle choisi ».
              initialSteps={sequence.steps.map((step) => ({
                id: step.id,
                offsetDays: step.offsetDays,
                tone: step.tone,
                templateId: step.templateId && !systemIds.has(step.templateId) ? step.templateId : null,
              }))}
              templates={templates.map((template) => ({
                id: template.id,
                name: template.name,
                tone: template.tone,
                isSystem: template.isSystem,
              }))}
            />
          </CardContent>
        </Card>
      </Reveal>
    </>
  );
}
