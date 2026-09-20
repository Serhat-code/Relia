import { CalendarClock, HandCoins, Timer, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { Reveal } from "@/components/motion/Reveal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import type { DashboardData } from "@/lib/data/dashboard";
import { DSO_PERIOD_DAYS } from "@/lib/dashboard/summary";
import { formatCurrency, pluralize } from "@/lib/format";
import { AgingChart } from "./AgingChart";
import { AtRiskList } from "./AtRiskList";
import { TodoList } from "./TodoList";

const invoiceCount = (count: number) => `${count} ${pluralize(count, "facture", "factures")}`;

/** Rien n'est converti : on le dit, plutôt que de laisser croire que ces factures ont disparu. */
const otherCurrencyNotice = (count: number) =>
  count === 1
    ? "Une facture en cours est libellée dans une autre devise et n'est pas comptée ici : des devises différentes ne s'additionnent pas."
    : `${count} factures en cours sont libellées dans d'autres devises et ne sont pas comptées ici : des devises différentes ne s'additionnent pas.`;

/** Tableau de bord (§5.7) : encours, retard, promesses, DSO, ancienneté, factures à risque, activité du jour. */
export function DashboardView({ data, today }: { data: DashboardData; today: string }) {
  const { summary, todo, activity } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal index={1} className="h-full">
          <StatCard
            className="h-full"
            label="Encours total"
            value={summary.openAmount}
            format="currency"
            currency={summary.currency}
            icon={<Wallet aria-hidden />}
            hint={`${invoiceCount(summary.openCount)}, dont ${formatCurrency(summary.notDueAmount, summary.currency)} à échoir`}
          />
        </Reveal>
        <Reveal index={2} className="h-full">
          <StatCard
            className="h-full"
            label="En retard"
            value={summary.lateAmount}
            format="currency"
            currency={summary.currency}
            tone={summary.lateAmount > 0 ? "danger" : "neutral"}
            icon={<TriangleAlert aria-hidden />}
            hint={invoiceCount(summary.lateCount)}
          />
        </Reveal>
        <Reveal index={3} className="h-full">
          <StatCard
            className="h-full"
            label="Sous promesse"
            value={summary.promisedAmount}
            format="currency"
            currency={summary.currency}
            tone={summary.promisedAmount > 0 ? "success" : "neutral"}
            icon={<HandCoins aria-hidden />}
            hint={summary.promisedCount > 0 ? `${invoiceCount(summary.promisedCount)}, relances suspendues` : "Aucune promesse en cours"}
          />
        </Reveal>
        <Reveal index={4} className="h-full">
          <StatCard
            className="h-full"
            label="DSO"
            value={summary.dso}
            format="days"
            icon={<Timer aria-hidden />}
            hint={
              summary.dso === null
                ? `Aucune facture émise sur ${DSO_PERIOD_DAYS} jours`
                : `Délai moyen d'encaissement, sur ${DSO_PERIOD_DAYS} jours`
            }
          />
        </Reveal>
      </div>

      {summary.otherCurrencyCount > 0 && (
        <Reveal index={4}>
          <p className="text-xs text-fg-muted">
            {`Ces chiffres portent sur vos factures en ${summary.currency}. ${otherCurrencyNotice(summary.otherCurrencyCount)}`}
          </p>
        </Reveal>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Reveal index={5}>
            <Card>
              <CardHeader>
                <CardTitle>Ancienneté des retards</CardTitle>
                <CardDescription>
                  {`Montants en retard, en ${summary.currency}, selon le temps écoulé depuis l'échéance.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <AgingChart buckets={summary.aging} currency={summary.currency} />
              </CardContent>
            </Card>
          </Reveal>
          <Reveal index={6}>
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2">
                <CardTitle>Factures à risque</CardTitle>
                <Link href="/app/factures?statut=en-retard" className="text-sm font-medium text-link hover:underline">
                  Tous les retards
                </Link>
              </CardHeader>
              <CardContent>
                <AtRiskList invoices={summary.atRisk} today={today} />
              </CardContent>
            </Card>
          </Reveal>
        </div>
        <div className="flex flex-col gap-6">
          <Reveal index={5}>
            <Card>
              <CardHeader>
                <CardTitle>À faire</CardTitle>
              </CardHeader>
              <CardContent>
                <TodoList todo={todo} />
              </CardContent>
            </Card>
          </Reveal>
          <Reveal index={6}>
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock aria-hidden className="size-4 text-fg-muted" />
                  Activité du jour
                </CardTitle>
                <Link href="/app/journal" className="text-sm font-medium text-link hover:underline">
                  Journal
                </Link>
              </CardHeader>
              <CardContent>
                <AuditTimeline entries={activity} emptyText="Rien encore aujourd'hui." />
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
