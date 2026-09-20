import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { AtRiskInvoice } from "@/lib/dashboard/summary";
import { describeRisk, RISK_LEVEL_LABELS, type RiskLevel } from "@/lib/debtors/scoring";
import { formatCurrency, formatDate } from "@/lib/format";
import { daysOverdue } from "@/lib/invoices/dates";

const LEVEL_TONES: Readonly<Record<RiskLevel, BadgeTone>> = { low: "success", moderate: "warning", high: "danger" };

type AtRiskListProps = { invoices: readonly AtRiskInvoice[]; today: string };

/**
 * Factures à risque : les retards les plus anciens, puis les plus élevés. Le score de risque du
 * client n'apparaît que s'il existe (personne morale avec historique, §2.4) ; jamais de score
 * pour un particulier ou un entrepreneur individuel.
 */
export function AtRiskList({ invoices, today }: AtRiskListProps) {
  if (invoices.length === 0) {
    return <p className="text-sm text-fg-muted">Aucune facture en retard. Les règlements arrivent à l&apos;heure.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {invoices.map((invoice) => {
        const late = daysOverdue(invoice.dueAt, today);
        return (
          <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Link href={`/app/factures/${invoice.id}`} className="truncate font-medium text-fg hover:underline">
                {invoice.debtor.name} · facture {invoice.number}
              </Link>
              <span className="text-xs text-fg-muted tabular-nums">
                Échue le {formatDate(invoice.dueAt)} ·{" "}
                <span className="font-medium text-danger">
                  {late} {late >= 2 ? "jours" : "jour"} de retard
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              {invoice.riskScore !== null && (
                <Badge tone={LEVEL_TONES[describeRisk(invoice.riskScore)]}>
                  Risque {RISK_LEVEL_LABELS[describeRisk(invoice.riskScore)].toLowerCase()}
                </Badge>
              )}
              <span className="text-sm font-semibold text-fg tabular-nums">{formatCurrency(invoice.amountTtc, invoice.currency)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
