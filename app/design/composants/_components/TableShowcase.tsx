"use client";

import { useState } from "react";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Section } from "../../_components/Section";
import { SAMPLE_INVOICES } from "./sample-invoices";

export function InvoicesTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Facture</TableHead>
          <TableHead>Débiteur</TableHead>
          <TableHead>Échéance</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead align="right">Montant TTC</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {SAMPLE_INVOICES.map((invoice, index) => (
          <TableRow key={invoice.number} index={index}>
            <TableCell className="font-medium whitespace-nowrap">{invoice.number}</TableCell>
            <TableCell className="whitespace-nowrap">{invoice.debtor}</TableCell>
            <TableCell>
              <time dateTime={invoice.dueAt}>{formatDate(invoice.dueAt)}</time>
            </TableCell>
            <TableCell>
              <InvoiceStatusBadge status={invoice.status} />
            </TableCell>
            <TableCell align="right" className="font-medium whitespace-nowrap">
              {formatCurrency(invoice.amount)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function TableShowcase() {
  const [replayKey, setReplayKey] = useState(0);

  return (
    <Section
      title="Tableau"
      description="Lignes en cascade à l'arrivée (40 ms par ligne), halo de bordure au survol, montants et dates en chiffres tabulaires."
    >
      <Card className="p-2">
        <InvoicesTable key={replayKey} />
      </Card>
      <Button variant="secondary" size="sm" className="w-fit" onClick={() => setReplayKey((key) => key + 1)}>
        Rejouer l&apos;apparition
      </Button>
    </Section>
  );
}
