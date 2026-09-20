import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/AppShell";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { BillingBanner, BillingSituationText } from "@/components/billing/BillingStatus";
import { PlanCards } from "@/components/billing/PlanCards";
import { Reveal } from "@/components/motion/Reveal";
import { CheckoutButton } from "@/components/settings/BillingActions";
import { OrganizationForm, RetentionForm } from "@/components/settings/OrganizationForms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { PLANS } from "@/lib/billing/plans";
import type { CurrentMember } from "@/lib/data/session";
import { isProductionDeployment } from "@/lib/env";

export const metadata: Metadata = { title: "Paramètres (démonstration)", robots: { index: false, follow: false } };

const DAY_MS = 86_400_000;

// Démonstration interne du palier 13 (sans base de données) : organisation en essai, 3 jours restants.
function demoOrganization(): CurrentMember["organization"] {
  return {
    id: "00000000-0000-4000-8000-0000000000a0",
    name: "Atelier Démo",
    siren: "732829320",
    plan: "trial",
    retentionMonths: 36,
    billing: {
      trialEndsAt: new Date(Date.now() + 2.5 * DAY_MS).toISOString(),
      subscriptionStatus: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      hasStripeCustomer: false,
    },
  };
}

export default function SettingsDemoPage() {
  if (isProductionDeployment()) notFound();
  const organization = demoOrganization();

  return (
    <AppShell member={{ organizationName: organization.name, userName: "Camille Démo", userEmail: "demo@relia.local" }}>
      <BillingBanner organization={organization} />
      <PageHeader title="Paramètres" description="Démonstration du palier 13, sans base de données." />
      <div className="flex flex-col gap-6">
        <Reveal index={1}>
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-xl font-semibold">Abonnement</h2>
              <p className="max-w-2xl text-sm text-fg-muted">
                <BillingSituationText organization={organization} />
              </p>
            </div>
            <PlanCards
              plans={PLANS}
              actions={Object.fromEntries(
                PLANS.map((plan) => [plan.id, <CheckoutButton key={plan.id} plan={plan.id} isHighlighted={Boolean(plan.isHighlighted)} />]),
              )}
            />
          </section>
        </Reveal>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Reveal index={2}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Organisation</CardTitle>
                <CardDescription>Le nom et le SIREN qui signent vos relances.</CardDescription>
              </CardHeader>
              <CardContent>
                <OrganizationForm name={organization.name} siren={organization.siren} canManage />
              </CardContent>
            </Card>
          </Reveal>
          <Reveal index={3}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Conservation des données</CardTitle>
                <CardDescription>Passé ce délai après la clôture d&apos;une facture, Relia efface automatiquement ses données.</CardDescription>
              </CardHeader>
              <CardContent>
                <RetentionForm months={organization.retentionMonths} canManage />
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </AppShell>
  );
}
