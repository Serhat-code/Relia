import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/AppShell";
import { BillingBanner } from "@/components/billing/BillingStatus";
import { FormMessage } from "@/components/ui/FormMessage";
import { isPaidPlan } from "@/lib/billing/plans";
import { getPlanUsage } from "@/lib/data/plan-usage";
import { requireMember } from "@/lib/data/session";
import { isSupabaseConfigured } from "@/lib/env";

// Pages privées : toujours rendues à la demande, jamais pré-rendues ni mises en cache.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Tableau de bord", template: "%s · Relia" },
  robots: { index: false, follow: false },
};

function ConfigurationMissing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <FormMessage tone="info">
        L&apos;application a besoin de Supabase : copiez <code>.env.example</code> vers <code>.env.local</code>,
        renseignez l&apos;URL et les clés de votre projet, puis relancez le serveur.
      </FormMessage>
    </main>
  );
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) return <ConfigurationMissing />;

  // Le décompte n'est lu que pour une offre payante : pendant l'essai, aucune limite ne s'applique.
  const member = await requireMember();
  const usage = isPaidPlan(member.organization.plan) ? await getPlanUsage() : undefined;
  return (
    <AppShell
      member={{
        organizationName: member.organization.name,
        userName: member.fullName ?? "",
        userEmail: member.email,
      }}
    >
      <BillingBanner organization={member.organization} usage={usage} />
      {children}
    </AppShell>
  );
}
