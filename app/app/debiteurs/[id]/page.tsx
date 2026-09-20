import { ArrowLeft, CircleAlert, FileText, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { DebtorForm } from "@/components/debtors/DebtorForm";
import { DebtorPrivacyCard } from "@/components/debtors/DebtorPrivacyCard";
import { RiskScoreCard } from "@/components/debtors/RiskScoreCard";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { Reveal } from "@/components/motion/Reveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { listEntityHistory } from "@/lib/data/audit";
import { getDebtor, type DebtorDetail } from "@/lib/data/debtors";
import { requireMember } from "@/lib/data/session";
import { CLIENT_TYPE_LABELS } from "@/lib/debtors/client-type";
import { todayInParis } from "@/lib/invoices/dates";
import { formatSiren } from "@/lib/siren";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const debtor = await getDebtor((await params).id);
  return { title: debtor ? debtor.name : "Client introuvable" };
}

const OPEN_STATUSES = new Set(["pending", "late", "promised"]);

/** Montants en euros des factures affichées (les factures en devise étrangère ne s'additionnent pas). */
function totals(debtor: DebtorDetail) {
  const euros = debtor.invoices.filter((invoice) => invoice.currency === "EUR");
  const sum = (predicate: (status: string) => boolean) =>
    euros.filter((invoice) => predicate(invoice.status)).reduce((total, invoice) => total + invoice.amountTtc, 0);
  return {
    open: sum((status) => OPEN_STATUSES.has(status)),
    late: sum((status) => status === "late"),
  };
}

export default async function DebtorPage({ params }: PageProps) {
  const { id } = await params;
  const [member, debtor] = await Promise.all([requireMember(), getDebtor(id)]);
  if (!debtor) notFound();
  const history = await listEntityHistory("debtor", debtor.id);
  const amounts = totals(debtor);
  const identity = [CLIENT_TYPE_LABELS[debtor.clientType], debtor.siren && `SIREN ${formatSiren(debtor.siren)}`].filter(Boolean).join(" · ");

  return (
    <>
      <Link
        href="/app/debiteurs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors duration-hover hover:text-fg"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Débiteurs
      </Link>
      <PageHeader title={debtor.name} description={identity} />

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Reveal index={1}>
            <StatCard
              label="Encours"
              value={amounts.open}
              format="currency"
              currency={member.organization.defaultCurrency}
              icon={<Wallet aria-hidden />}
            />
          </Reveal>
          <Reveal index={2}>
            <StatCard
              label="En retard"
              value={amounts.late}
              format="currency"
              currency={member.organization.defaultCurrency}
              tone={amounts.late > 0 ? "danger" : "neutral"}
              icon={<CircleAlert aria-hidden />}
            />
          </Reveal>
          <Reveal index={3}>
            <StatCard label="Factures" value={debtor.invoices.length} format="number" icon={<FileText aria-hidden />} />
          </Reveal>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Reveal index={2}>
              <Card>
                <CardHeader>
                  <CardTitle>Factures</CardTitle>
                </CardHeader>
                <CardContent className="px-2 sm:px-4">
                  <InvoiceTable
                    invoices={debtor.invoices}
                    today={todayInParis()}
                    emptyMessage="Aucune facture pour ce client."
                  />
                </CardContent>
              </Card>
            </Reveal>
            <Reveal index={3}>
              <Card>
                <CardHeader>
                  <CardTitle>Fiche</CardTitle>
                </CardHeader>
                <CardContent>
                  <DebtorForm debtorId={debtor.id} debtor={debtor} />
                </CardContent>
              </Card>
            </Reveal>
          </div>
          <div className="flex flex-col gap-6">
            <Reveal index={2}>
              <RiskScoreCard
                clientType={debtor.clientType}
                siren={debtor.siren}
                isLegalEntity={debtor.isLegalEntity}
                riskScore={debtor.riskScore}
                paymentBehaviorDays={debtor.paymentBehaviorDays}
              />
            </Reveal>
            <Reveal index={3}>
              <DebtorPrivacyCard
                debtorId={debtor.id}
                debtorName={debtor.name}
                canErase={member.role === "owner" || member.role === "admin"}
              />
            </Reveal>
            <Reveal index={4}>
              <Card>
                <CardHeader>
                  <CardTitle>Historique</CardTitle>
                </CardHeader>
                <CardContent>
                  <AuditTimeline entries={history} />
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </div>
      </div>
    </>
  );
}
