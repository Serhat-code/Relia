import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { CLIENT_TYPE_SHORT_LABELS } from "@/lib/debtors/client-type";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ImportRow } from "@/lib/invoices/import-row";

/** Aperçu des premières factures prêtes à importer, telles que Relia les a comprises. */
export function ImportPreview({ rows, limit = 5 }: { rows: readonly ImportRow[]; limit?: number }) {
  return (
    <Table>
      <TableHeader>
        <tr>
          <TableHead>Facture</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Émise le</TableHead>
          <TableHead>Échéance</TableHead>
          <TableHead align="right">Montant TTC</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {rows.slice(0, limit).map((row, index) => (
          <TableRow key={`${row.number}-${index}`} index={index}>
            <TableCell className="font-medium">{row.number}</TableCell>
            <TableCell>
              <span className="block max-w-56 truncate">{row.debtorName}</span>
              <span className="text-xs text-fg-muted">{CLIENT_TYPE_SHORT_LABELS[row.clientType]}</span>
            </TableCell>
            <TableCell className="tabular-nums">{formatDate(row.issuedAt)}</TableCell>
            <TableCell className="tabular-nums">{formatDate(row.dueAt)}</TableCell>
            <TableCell align="right" className="tabular-nums">
              {formatCurrency(row.amountTtc, row.currency)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
