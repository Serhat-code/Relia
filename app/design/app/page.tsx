import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/AppShell";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { isProductionDeployment } from "@/lib/env";

export const metadata: Metadata = { title: "Cadre de l'application", robots: { index: false, follow: false } };

// Démonstration interne du cadre de l'application (sans base de données) : membre fictif.
export default function AppShellDemoPage() {
  if (isProductionDeployment()) notFound();

  return (
    <AppShell member={{ organizationName: "Atelier Démo", userName: "Camille Démo", userEmail: "demo@relia.local" }}>
      <PageHeader title="Bonjour Camille" description="Voici où en sont les règlements de vos clients." />
      <Reveal index={1}>
        <OnboardingChecklist progress={{ hasActiveMailbox: false, hasInvoices: false, hasSampleData: false }} canManage />
      </Reveal>
    </AppShell>
  );
}
