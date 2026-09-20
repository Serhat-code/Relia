import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/AppShell";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { StepEditor } from "@/components/sequences/StepEditor";
import { MessagePreview } from "@/components/templates/MessagePreview";
import { TemplateEditor } from "@/components/templates/TemplateEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { isProductionDeployment } from "@/lib/env";
import { todayInParis } from "@/lib/invoices/dates";
import { renderTemplate } from "@/lib/templates/engine";
import { previewContext } from "@/lib/templates/preview";
import { SYSTEM_TEMPLATES } from "@/lib/templates/system-templates";

export const metadata: Metadata = { title: "Modèles (démonstration)", robots: { index: false, follow: false } };

// Démonstration interne du palier 8 (sans base de données) : modèles système, éditeur, scénario.
const ORGANIZATION = "Atelier Démo";

export default function TemplatesDemoPage() {
  if (isProductionDeployment()) notFound();
  const today = todayInParis();
  const firm = SYSTEM_TEMPLATES.find((template) => template.clientType === "b2b" && template.tone === "ferme");
  const consumerNotice = SYSTEM_TEMPLATES.find(
    (template) => template.clientType === "b2c" && template.tone === "mise_en_demeure",
  );
  const previews = [firm, consumerNotice].flatMap((template) => {
    if (!template) return [];
    const result = renderTemplate(template, previewContext(template.clientType, ORGANIZATION, today));
    return result.ok ? [{ template, result }] : [];
  });

  return (
    <AppShell member={{ organizationName: ORGANIZATION, userName: "Camille Démo", userEmail: "demo@relia.local" }}>
      <PageHeader title="Modèles et scénarios" description="Démonstration du palier 8, sans base de données." />
      <div className="flex flex-col gap-10">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {previews.map(({ template, result }, index) => (
            <Reveal key={template.id} index={index + 1}>
              <Card>
                <CardHeader>
                  <CardTitle>{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <MessagePreview from={ORGANIZATION} subject={result.subject} bodyMarkdown={result.bodyMarkdown} />
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
        <Reveal index={3}>
          <Card>
            <CardHeader>
              <CardTitle>Modèle personnalisé (une menace glissée dans le texte)</CardTitle>
            </CardHeader>
            <CardContent>
              <TemplateEditor
                templateId="00000000-0000-4000-8000-000000000999"
                clientType="b2c"
                initial={{
                  name: "Relance personnalisée — particuliers",
                  subject: "Facture {{numero_facture}} : un petit rappel",
                  bodyMarkdown:
                    "{{salutation}}\n\nLa facture n° {{numero_facture}} de {{montant}} {{statut_echeance}}.\n\nSans règlement, un huissier passera et une indemnité forfaitaire de 40 € s'appliquera.\n\n{{nom_entreprise}}",
                }}
                organizationName={ORGANIZATION}
                today={today}
              />
            </CardContent>
          </Card>
        </Reveal>
        <Reveal index={4}>
          <Card>
            <CardHeader>
              <CardTitle>Scénario professionnels</CardTitle>
            </CardHeader>
            <CardContent>
              <StepEditor
                sequenceId="00000000-0000-4000-8000-000000000998"
                initialSteps={[
                  { id: null, offsetDays: -3, tone: "courtois", templateId: null },
                  { id: null, offsetDays: 7, tone: "courtois", templateId: null },
                  { id: null, offsetDays: 15, tone: "ferme", templateId: null },
                  { id: null, offsetDays: 30, tone: "mise_en_demeure", templateId: null },
                ]}
                templates={[
                  {
                    id: "00000000-0000-4000-8000-000000000997",
                    name: "Relance ferme — professionnels (personnalisé)",
                    tone: "ferme",
                    isSystem: false,
                  },
                ]}
              />
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </AppShell>
  );
}
