import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/AppShell";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { ImportWizard } from "@/components/invoices/import/ImportWizard";
import { Reveal } from "@/components/motion/Reveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { Pagination } from "@/components/ui/Pagination";
import type { InvoiceListItem } from "@/lib/data/invoices";
import { isProductionDeployment } from "@/lib/env";
import { addDays, todayInParis } from "@/lib/invoices/dates";

export const metadata: Metadata = { title: "Factures (démonstration)", robots: { index: false, follow: false } };

// Démonstration interne des écrans de factures (sans base de données) : données fictives.
function sampleInvoices(today: string): InvoiceListItem[] {
  const invoice = (
    number: string,
    debtorName: string,
    amountTtc: number,
    dueOffset: number,
    status: InvoiceListItem["status"],
    clientType: InvoiceListItem["clientType"] = "b2b",
  ): InvoiceListItem => ({
    id: `00000000-0000-4000-8000-${number.replace(/\D/g, "").padStart(12, "0")}`,
    number,
    debtorId: "00000000-0000-4000-8000-000000000000",
    debtorName,
    clientType,
    amountTtc,
    currency: "EUR",
    issuedAt: addDays(today, dueOffset - 30),
    dueAt: addDays(today, dueOffset),
    paidAt: status === "paid" ? addDays(today, -2) : null,
    status,
    daysOverdue: Math.max(0, -dueOffset),
  });

  return [
    invoice("F-2026-0412", "Menuiserie Caradec & Fils", 4820, -38, "late"),
    invoice("F-2026-0427", "Boulangerie Le Fournil", 312.5, -12, "late", "b2c"),
    invoice("F-2026-0431", "Studio Ancre", 1440, -4, "promised"),
    invoice("F-2026-0450", "Cabinet Morvan Architectes", 9600, 0, "pending"),
    invoice("F-2026-0452", "Garage des Quatre Vents", 780, 5, "pending"),
    invoice("F-2026-0458", "Hôtel de la Plage", 12350.9, 24, "pending"),
    invoice("F-2026-0391", "Atelier Kerbrat", 2100, -20, "paid"),
  ];
}

export default function InvoicesDemoPage() {
  if (isProductionDeployment()) notFound();
  const today = todayInParis();
  const invoices = sampleInvoices(today);
  const tabs = [
    { label: "À encaisser", href: "/design/factures", count: 6, isActive: true },
    { label: "En retard", href: "/design/factures?statut=en-retard", count: 2, isActive: false },
    { label: "Promesses", href: "/design/factures?statut=promesses", count: 1, isActive: false },
    { label: "Payées", href: "/design/factures?statut=payees", count: 1, isActive: false },
    { label: "Toutes", href: "/design/factures?statut=toutes", count: 7, isActive: false },
  ];

  return (
    <AppShell member={{ organizationName: "Atelier Démo", userName: "Camille Démo", userEmail: "demo@relia.local" }}>
      <PageHeader title="Factures" description="Démonstration des écrans du palier 6, avec des données fictives." />
      <div className="flex flex-col gap-10">
        <Reveal index={1}>
          <Card className="flex flex-col gap-4 p-4 sm:p-5">
            <LinkTabs tabs={tabs} label="Filtrer par statut" />
            <InvoiceTable invoices={invoices} today={today} emptyMessage="Aucune facture." />
            <Pagination page={1} pageCount={3} total={62} pageSize={25} hrefForPage={() => "/design/factures"} />
          </Card>
        </Reveal>
        <Reveal index={2}>
          <EmptyState
            title="Aucune facture pour l'instant"
            description="Importez l'export CSV de votre logiciel de facturation, déposez des factures électroniques Factur-X, ou saisissez une facture à la main."
          />
        </Reveal>
        <Reveal index={3}>
          <Card>
            <CardHeader>
              <CardTitle>Import (lecture dans le navigateur ; l&apos;envoi exige une session)</CardTitle>
            </CardHeader>
            <CardContent>
              <ImportWizard />
            </CardContent>
          </Card>
        </Reveal>
        <Reveal index={4} className="max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Saisie manuelle</CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceForm
                today={today}
                debtors={[{ name: "Menuiserie Caradec & Fils", clientType: "b2b", siren: "123456782", email: "compta@caradec.example" }]}
              />
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </AppShell>
  );
}
