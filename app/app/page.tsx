import { PageHeader } from "@/components/app-shell/PageHeader";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { Reveal } from "@/components/motion/Reveal";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { SampleDataBanner } from "@/components/onboarding/SampleData";
import { getDashboardData } from "@/lib/data/dashboard";
import { getOnboardingProgress } from "@/lib/data/onboarding";
import { requireMember } from "@/lib/data/session";
import { todayInParis } from "@/lib/invoices/dates";

const firstName = (fullName: string | null) => fullName?.trim().split(/\s+/)[0];

export default async function DashboardPage() {
  const [member, progress, dashboard] = await Promise.all([requireMember(), getOnboardingProgress(), getDashboardData()]);
  const isOnboarded = progress.hasActiveMailbox && progress.hasInvoices;
  const name = firstName(member.fullName);

  return (
    <>
      <PageHeader
        title={name ? `Bonjour ${name}` : "Bonjour"}
        description={`Voici où en sont les règlements de vos clients. Montants en ${dashboard.summary.currency}, toutes taxes comprises.`}
      />
      <div className="flex flex-col gap-6">
        {progress.hasSampleData && (
          <Reveal index={1}>
            <SampleDataBanner />
          </Reveal>
        )}
        {!isOnboarded && (
          <Reveal index={1}>
            <OnboardingChecklist progress={progress} canManage={member.role !== "member"} />
          </Reveal>
        )}
        <DashboardView data={dashboard} today={todayInParis()} />
      </div>
    </>
  );
}
