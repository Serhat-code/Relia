import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { RowLink } from "@/components/ui/RowLink";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import type { InvoiceListItem } from "@/lib/data/invoices";
import { CLIENT_TYPE_SHORT_LABELS } from "@/lib/debtors/client-type";
import { formatCurrency, formatDate } from "@/lib/format";
import { describeDue } from "@/lib/invoices/dates";

const DUE_TONES = { late: "text-danger", soon: "text-warning", future: "text-fg-muted" } as const;

function DueCell({ invoice, today }: { invoice: InvoiceListItem; today: string }) {
  if (invoice.status === "paid" && invoice.paidAt) {
    return <span className="text-xs text-fg-muted">Payée le {formatDate(invoice.paidAt)}</span>;
  }
  if (invoice.status === "cancelled") return null;
  const due = describeDue(invoice.dueAt, today);
  return <span className={cn("text-xs font-medium", DUE_TONES[due.tone])}>{due.text}</span>;
}

type InvoiceTableProps = { invoices: readonly InvoiceListItem[]; today: string; emptyMessage: string };

export function InvoiceTable({ invoices, today, emptyMessage }: InvoiceTableProps) {
  return (
    <Table>
      <TableHeader>
        <tr>
          <TableHead>Facture</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Échéance</TableHead>
          <TableHead align="right">Montant TTC</TableHead>
          <TableHead>Statut</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {invoices.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-12 text-center text-sm text-fg-muted">
              {emptyMessage}
            </td>
          </tr>
        )}
        {invoices.map((invoice, index) => {
          const href = `/app/factures/${invoice.id}`;
          return (
            <TableRow key={invoice.id} index={index}>
              <TableCell className="p-0">
                <RowLink href={href} isPrimary>
                  <span className="font-medium text-fg">{invoice.number}</span>
                  <span className="text-xs text-fg-muted">Émise le {formatDate(invoice.issuedAt)}</span>
                </RowLink>
              </TableCell>
              <TableCell className="p-0">
                <RowLink href={href}>
                  <span className="max-w-64 truncate text-fg">{invoice.debtorName}</span>
                  <span className="text-xs text-fg-muted">{CLIENT_TYPE_SHORT_LABELS[invoice.clientType]}</span>
                </RowLink>
              </TableCell>
              <TableCell className="p-0">
                <RowLink href={href}>
                  <span className="text-fg tabular-nums">{formatDate(invoice.dueAt)}</span>
                  <DueCell invoice={invoice} today={today} />
                </RowLink>
              </TableCell>
              <TableCell className="p-0" align="right">
                <RowLink href={href}>
                  <span className="font-medium text-fg tabular-nums">
                    {formatCurrency(invoice.amountTtc, invoice.currency)}
                  </span>
                </RowLink>
              </TableCell>
              <TableCell className="p-0">
                <RowLink href={href}>
                  <span>
                    <InvoiceStatusBadge status={invoice.status} />
                  </span>
                </RowLink>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
