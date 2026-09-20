import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/AppShell";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { JournalView } from "@/components/audit/JournalView";
import { journalCategory } from "@/lib/audit/categories";
import { describeActor, describeAuditAction } from "@/lib/audit/describe";
import type { AuditEntry } from "@/lib/data/audit";
import { isProductionDeployment } from "@/lib/env";
import type { Json } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Journal (démonstration)", robots: { index: false, follow: false } };

const INVOICE = "/design/factures";

// Démonstration interne du palier 12 (sans base de données) : phrases produites par describeAuditAction.
const EVENTS: ReadonlyArray<[string, Json, "user" | "system" | "ai", string]> = [
  ["reply.received", { kind: "dispute", paused: true }, "ai", "2026-09-21T09:12:00Z"],
  ["reminder.sent", {}, "system", "2026-09-21T08:31:00Z"],
  ["reminder.approved", { edited: true }, "user", "2026-09-21T07:40:00Z"],
  ["reminder.planned", { awaiting_approval: true }, "ai", "2026-09-21T07:02:00Z"],
  ["promise.broken", {}, "system", "2026-09-21T06:58:00Z"],
  ["promise.recorded", { source: "email_reply", promised_date: "2026-09-30" }, "ai", "2026-09-19T09:12:00Z"],
  ["invoice.status_changed", { from: "late", to: "paid", reminders_cancelled: 1 }, "user", "2026-09-18T16:20:00Z"],
  ["invoices.imported", { source: "csv", created: 12, skipped: 1, debtors_created: 3 }, "user", "2026-09-18T10:05:00Z"],
  ["mailbox.connected", { provider: "gmail" }, "user", "2026-09-18T09:47:00Z"],
  ["dpa.accepted", { version: "2026-09" }, "user", "2026-09-18T09:30:00Z"],
];

const ENTRIES: AuditEntry[] = EVENTS.map(([action, payload, actor, createdAt], index) => ({
  id: EVENTS.length - index,
  createdAt,
  actor: describeActor(actor, actor === "user" ? "Camille Démo" : null),
  description: describeAuditAction(action, payload),
  link: action.startsWith("mailbox") || action.startsWith("dpa") || action === "invoices.imported" ? null : { href: INVOICE, label: "Voir la facture" },
}));

export default function JournalDemoPage() {
  if (isProductionDeployment()) notFound();

  return (
    <AppShell member={{ organizationName: "Atelier Démo", userName: "Camille Démo", userEmail: "demo@relia.local" }}>
      <PageHeader title="Journal" description="Démonstration du palier 12, sans base de données." />
      <JournalView
        category={journalCategory(undefined)}
        page={1}
        journal={{ entries: ENTRIES, total: 124, pageCount: 3 }}
        pageSize={50}
        basePath="/design/journal"
      />
    </AppShell>
  );
}
