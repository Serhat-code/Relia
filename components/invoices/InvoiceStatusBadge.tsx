import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/lib/invoices/status";

const STATUS_TONES: Record<InvoiceStatus, BadgeTone> = {
  pending: "neutral",
  late: "danger",
  promised: "accent",
  paid: "success",
  disputed: "warning",
  cancelled: "neutral",
};

/** Statut de facture ; seul « en retard » pulse doucement (CLAUDE.md §6). */
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge
      tone={STATUS_TONES[status]}
      hasPulse={status === "late"}
      className={status === "cancelled" ? "text-fg-muted" : undefined}
    >
      {INVOICE_STATUS_LABELS[status]}
    </Badge>
  );
}
