import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { INVOICE_STATUSES } from "@/lib/invoices/status";
import { Section } from "../../_components/Section";

const TONES: ReadonlyArray<{ tone: BadgeTone; label: string }> = [
  { tone: "neutral", label: "Neutre" },
  { tone: "accent", label: "Accent" },
  { tone: "success", label: "Succès" },
  { tone: "warning", label: "Attention" },
  { tone: "danger", label: "Danger" },
];

export function BadgesShowcase() {
  return (
    <Section
      title="Badges"
      description="Pastille colorée et libellé toujours lisible. Seul le statut « en retard » pulse, doucement."
    >
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-elevated p-6">
        <div className="flex flex-wrap gap-2">
          {TONES.map(({ tone, label }) => (
            <Badge key={tone} tone={tone}>
              {label}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {INVOICE_STATUSES.map((status) => (
            <InvoiceStatusBadge key={status} status={status} />
          ))}
        </div>
      </div>
    </Section>
  );
}
