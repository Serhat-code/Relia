import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { RowLink } from "@/components/ui/RowLink";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import type { DebtorListItem } from "@/lib/data/debtors";
import { CLIENT_TYPE_SHORT_LABELS } from "@/lib/debtors/client-type";
import { RISK_LEVEL_LABELS, scoreForDisplay, type RiskLevel } from "@/lib/debtors/scoring";
import { formatCurrency, formatNumber } from "@/lib/format";
import { formatSiren } from "@/lib/siren";

const LEVEL_TONES: Readonly<Record<RiskLevel, BadgeTone>> = { low: "success", moderate: "warning", high: "danger" };

function RiskCell({ debtor }: { debtor: DebtorListItem }) {
  const display = scoreForDisplay(debtor, debtor.riskScore);
  if (display.kind === "not_applicable") return <span className="text-xs text-fg-muted">Non applicable</span>;
  if (display.kind === "no_history") return <span className="text-xs text-fg-muted">—</span>;
  return (
    <span>
      <Badge tone={LEVEL_TONES[display.level]}>
        <span className="tabular-nums">{display.score}</span> · {RISK_LEVEL_LABELS[display.level]}
      </Badge>
    </span>
  );
}

type DebtorTableProps = { debtors: readonly DebtorListItem[]; emptyMessage: string };

export function DebtorTable({ debtors, emptyMessage }: DebtorTableProps) {
  return (
    <Table>
      <TableHeader>
        <tr>
          <TableHead>Client</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead align="right">Factures</TableHead>
          <TableHead align="right">En retard</TableHead>
          <TableHead align="right">Encours</TableHead>
          <TableHead>Risque</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {debtors.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-12 text-center text-sm text-fg-muted">
              {emptyMessage}
            </td>
          </tr>
        )}
        {debtors.map((debtor, index) => {
          const href = `/app/debiteurs/${debtor.id}`;
          return (
            <TableRow key={debtor.id} index={index}>
              <TableCell className="p-0">
                <RowLink href={href} isPrimary>
                  <span className="max-w-72 truncate font-medium text-fg">{debtor.name}</span>
                  <span className="text-xs text-fg-muted">
                    {CLIENT_TYPE_SHORT_LABELS[debtor.clientType]}
                    {debtor.siren && <span className="tabular-nums"> · SIREN {formatSiren(debtor.siren)}</span>}
                  </span>
                </RowLink>
              </TableCell>
              <TableCell className="p-0">
                <RowLink href={href}>
                  {debtor.contactEmail ? (
                    <span className="max-w-64 truncate text-fg">{debtor.contactEmail}</span>
                  ) : (
                    <span className="text-xs font-medium text-warning">E-mail manquant</span>
                  )}
                </RowLink>
              </TableCell>
              <TableCell className="p-0" align="right">
                <RowLink href={href}>
                  <span className="text-fg tabular-nums">{formatNumber(debtor.invoiceCount)}</span>
                </RowLink>
              </TableCell>
              <TableCell className="p-0" align="right">
                <RowLink href={href}>
                  {debtor.lateAmount > 0 ? (
                    <span className="font-medium text-danger tabular-nums">{formatCurrency(debtor.lateAmount)}</span>
                  ) : (
                    <span className="text-fg-muted">—</span>
                  )}
                </RowLink>
              </TableCell>
              <TableCell className="p-0" align="right">
                <RowLink href={href}>
                  <span className="font-medium text-fg tabular-nums">{formatCurrency(debtor.openAmount)}</span>
                </RowLink>
              </TableCell>
              <TableCell className="p-0">
                <RowLink href={href}>
                  <RiskCell debtor={debtor} />
                </RowLink>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
