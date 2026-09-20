import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { ImportWizard } from "@/components/invoices/import/ImportWizard";
import { Reveal } from "@/components/motion/Reveal";
import { Card, CardContent } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Importer des factures" };

export default function ImportInvoicesPage() {
  return (
    <>
      <PageHeader
        title="Importer des factures"
        description="Depuis l'export CSV de votre logiciel de facturation, ou directement depuis vos factures électroniques Factur-X. Les numéros déjà présents sont ignorés."
      />
      <Reveal index={1} className="max-w-5xl">
        <Card>
          <CardContent>
            <ImportWizard />
          </CardContent>
        </Card>
      </Reveal>
    </>
  );
}
