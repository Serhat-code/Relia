import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { ImportWizard } from "@/components/invoices/import/ImportWizard";
import { Reveal } from "@/components/motion/Reveal";
import { SampleDataCard } from "@/components/onboarding/SampleData";
import { Card, CardContent } from "@/components/ui/Card";
import { getOnboardingProgress } from "@/lib/data/onboarding";
import { requireMember } from "@/lib/data/session";

export const metadata: Metadata = { title: "Importer des factures" };

export default async function ImportInvoicesPage() {
  const [member, progress] = await Promise.all([requireMember(), getOnboardingProgress()]);

  return (
    <>
      <PageHeader
        title="Importer des factures"
        description="Depuis l'export CSV de votre logiciel de facturation, ou directement depuis vos factures électroniques. Les numéros déjà présents sont ignorés."
      />
      <div className="flex max-w-5xl flex-col gap-6">
        <Reveal index={1}>
          <Card>
            <CardContent>
              <ImportWizard />
            </CardContent>
          </Card>
        </Reveal>
        {/* Le jeu d'essai vit ici : c'est la page où l'on vient quand on cherche des données. */}
        <Reveal index={2}>
          <SampleDataCard canManage={member.role !== "member"} isLoaded={progress.hasSampleData} />
        </Reveal>
      </div>
    </>
  );
}
