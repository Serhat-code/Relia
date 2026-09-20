import type { Json } from "@/lib/supabase/database.types";

/**
 * Journal d'audit consultable (§5.8) : filtres par thème et lien vers l'élément concerné. Les
 * filtres sont des conditions PostgREST sur l'action (motifs fixes, jamais saisis par l'utilisateur).
 */

export const JOURNAL_CATEGORIES = [
  { slug: "tout", label: "Tout", filter: null },
  {
    slug: "factures",
    label: "Factures",
    filter: "action.in.(invoice.created,invoice.status_changed,invoice.updated,invoices.imported)",
  },
  { slug: "relances", label: "Relances", filter: "action.like.reminder.*,action.like.sequence.*" },
  {
    slug: "reponses",
    label: "Réponses et promesses",
    filter: "action.like.reply.*,action.like.replies.*,action.like.promise.*,action.eq.invoice.reminders_resumed",
  },
  { slug: "clients", label: "Clients", filter: "action.like.debtor.*" },
  {
    slug: "compte",
    label: "Compte et abonnement",
    filter: "action.like.mailbox.*,action.like.organization.*,action.like.dpa.*,action.like.subscription.*,action.like.data.*",
  },
] as const;

export type JournalCategory = (typeof JOURNAL_CATEGORIES)[number];

export function journalCategory(slug: string | undefined): JournalCategory {
  return JOURNAL_CATEGORIES.find((category) => category.slug === slug) ?? JOURNAL_CATEGORIES[0];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LinkableEntry = { action: string; entityType: string; entityId: string | null; payload: Json };

/** Page de l'élément concerné, s'il existe encore une page à ouvrir (un client effacé n'en a plus). */
export function entryLink(entry: LinkableEntry): { href: string; label: string } | null {
  if (entry.entityType === "invoice" && entry.entityId && entry.action !== "invoices.imported") {
    return { href: `/app/factures/${entry.entityId}`, label: "Voir la facture" };
  }
  if (entry.entityType === "debtor" && entry.entityId && entry.action !== "debtor.deleted") {
    return { href: `/app/debiteurs/${entry.entityId}`, label: "Voir le client" };
  }
  if (entry.entityType === "organization" && /^(subscription|organization)\./.test(entry.action)) {
    return { href: "/app/parametres", label: "Voir les paramètres" };
  }
  const payload = entry.payload;
  const invoiceId = typeof payload === "object" && payload !== null && !Array.isArray(payload) ? payload.invoice_id : undefined;
  if (typeof invoiceId === "string" && UUID.test(invoiceId)) {
    return { href: `/app/factures/${invoiceId}`, label: "Voir la facture" };
  }
  return null;
}
