import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/AppShell";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { DebtorForm } from "@/components/debtors/DebtorForm";
import { DebtorPrivacyCard } from "@/components/debtors/DebtorPrivacyCard";
import { DebtorTable } from "@/components/debtors/DebtorTable";
import { RiskScoreCard } from "@/components/debtors/RiskScoreCard";
import { Reveal } from "@/components/motion/Reveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { LinkTabs } from "@/components/ui/LinkTabs";
import type { DebtorListItem } from "@/lib/data/debtors";
import { isProductionDeployment } from "@/lib/env";

export const metadata: Metadata = { title: "Débiteurs (démonstration)", robots: { index: false, follow: false } };

// Démonstration interne des écrans des débiteurs (sans base de données) : données fictives.
const DEBTORS: DebtorListItem[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Menuiserie Caradec & Fils",
    clientType: "b2b",
    siren: "123456782",
    isLegalEntity: true,
    contactEmail: "compta@caradec.example",
    riskScore: 68,
    paymentBehaviorDays: 34,
    invoiceCount: 12,
    openAmount: 9640,
    lateAmount: 4820,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Studio Ancre",
    clientType: "b2b",
    siren: "732829320",
    isLegalEntity: true,
    contactEmail: "facturation@ancre.example",
    riskScore: 18,
    paymentBehaviorDays: 3,
    invoiceCount: 5,
    openAmount: 1440,
    lateAmount: 0,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Garage des Quatre Vents",
    clientType: "b2b",
    siren: "552100554",
    isLegalEntity: false,
    contactEmail: null,
    riskScore: null,
    paymentBehaviorDays: 12,
    invoiceCount: 3,
    openAmount: 780,
    lateAmount: 780,
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    name: "Boulangerie Le Fournil",
    clientType: "b2c",
    siren: null,
    isLegalEntity: false,
    contactEmail: "contact@fournil.example",
    riskScore: null,
    paymentBehaviorDays: -2,
    invoiceCount: 2,
    openAmount: 312.5,
    lateAmount: 312.5,
  },
];

export default function DebtorsDemoPage() {
  if (isProductionDeployment()) notFound();
  const tabs = [
    { label: "Tous", href: "/design/debiteurs", isActive: true },
    { label: "Professionnels", href: "/design/debiteurs?type=professionnels", isActive: false },
    { label: "Particuliers", href: "/design/debiteurs?type=particuliers", isActive: false },
  ];

  return (
    <AppShell member={{ organizationName: "Atelier Démo", userName: "Camille Démo", userEmail: "demo@relia.local" }}>
      <PageHeader title="Débiteurs" description="Démonstration des écrans du palier 7, avec des données fictives." />
      <div className="flex flex-col gap-10">
        <Reveal index={1}>
          <Card className="flex flex-col gap-4 p-4 sm:p-5">
            <LinkTabs tabs={tabs} label="Filtrer par type de client" />
            <DebtorTable debtors={DEBTORS} emptyMessage="Aucun client." />
          </Card>
        </Reveal>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Reveal index={2}>
            <RiskScoreCard clientType="b2b" siren="123456782" isLegalEntity riskScore={68} paymentBehaviorDays={34} />
          </Reveal>
          <Reveal index={3}>
            <RiskScoreCard clientType="b2b" siren="552100554" isLegalEntity={false} riskScore={null} paymentBehaviorDays={12} />
          </Reveal>
          <Reveal index={4}>
            <RiskScoreCard clientType="b2b" siren="732829320" isLegalEntity riskScore={null} paymentBehaviorDays={null} />
          </Reveal>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Reveal index={5} className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Fiche</CardTitle>
              </CardHeader>
              <CardContent>
                <DebtorForm
                  debtorId={DEBTORS[0]?.id ?? ""}
                  debtor={{
                    name: "Menuiserie Caradec & Fils",
                    clientType: "b2b",
                    siren: "123456782",
                    isLegalEntity: true,
                    contactName: "Yann Caradec",
                    contactEmail: "compta@caradec.example",
                    phone: "02 98 00 00 00",
                    address: "4 rue du Port, 29000 Quimper",
                    notes: null,
                  }}
                />
              </CardContent>
            </Card>
          </Reveal>
          <Reveal index={6}>
            <DebtorPrivacyCard debtorId={DEBTORS[0]?.id ?? ""} debtorName="Menuiserie Caradec & Fils" canErase />
          </Reveal>
        </div>
      </div>
    </AppShell>
  );
}
