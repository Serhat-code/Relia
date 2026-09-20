import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/AppShell";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { MailboxCard } from "@/components/mailbox/MailboxCard";
import { SmtpForm } from "@/components/mailbox/SmtpForm";
import { Reveal } from "@/components/motion/Reveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { isProductionDeployment } from "@/lib/env";

export const metadata: Metadata = { title: "Boîte d'envoi (démonstration)", robots: { index: false, follow: false } };

// Démonstration interne du palier 9 (sans base de données ni fournisseur OAuth).
export default function MailboxDemoPage() {
  if (isProductionDeployment()) notFound();

  return (
    <AppShell member={{ organizationName: "Atelier Démo", userName: "Camille Démo", userEmail: "demo@relia.local" }}>
      <PageHeader title="Boîte d'envoi" description="Démonstration des paliers 9 et 11, sans base de données." />
      <div className="flex max-w-4xl flex-col gap-6">
        <Reveal index={1}>
          <MailboxCard
            canManage
            mailbox={{
              provider: "gmail",
              emailAddress: "compta@atelier-demo.fr",
              displayName: "Atelier Démo",
              status: "active",
              lastVerifiedAt: "2026-09-19T08:12:00Z",
              smtpHost: null,
              imapHost: null,
              repliesCheckedAt: "2026-09-19T08:30:00Z",
              repliesError: null,
            }}
          />
        </Reveal>
        <Reveal index={2}>
          <MailboxCard
            canManage
            mailbox={{
              provider: "smtp",
              emailAddress: "factures@atelier-demo.fr",
              displayName: "Atelier Démo",
              status: "error",
              lastVerifiedAt: null,
              smtpHost: "ssl0.ovh.net",
              imapHost: null,
              repliesCheckedAt: null,
              repliesError: null,
            }}
          />
        </Reveal>
        <Reveal index={2}>
          <MailboxCard
            canManage
            mailbox={{
              provider: "smtp",
              emailAddress: "contact@atelier-demo.fr",
              displayName: "Atelier Démo",
              status: "active",
              lastVerifiedAt: "2026-09-18T07:31:00Z",
              smtpHost: "smtp.ionos.fr",
              imapHost: null,
              repliesCheckedAt: null,
              repliesError: null,
            }}
          />
        </Reveal>
        <Reveal index={3}>
          <Card>
            <CardHeader>
              <CardTitle>Autre messagerie (SMTP)</CardTitle>
            </CardHeader>
            <CardContent>
              <SmtpForm defaultSenderName="Atelier Démo" />
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </AppShell>
  );
}
