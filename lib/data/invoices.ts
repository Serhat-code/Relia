import "server-only";
import { cache } from "react";
import { z } from "zod";
import { daysOverdue, effectiveStatus, todayInParis } from "@/lib/invoices/dates";
import { importBatchSchema, toRpcRow, type ImportRow } from "@/lib/invoices/import-row";
import {
  INVOICE_FILTERS,
  INVOICES_PAGE_SIZE,
  type InvoiceFilter,
  type InvoiceListQuery,
} from "@/lib/invoices/list-query";
import type { InvoiceStatus } from "@/lib/invoices/status";
import { nextStatus, type StatusAction } from "@/lib/invoices/transitions";
import type { Enums, Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Factures de l'organisation du membre connecté : la RLS limite chaque requête à son organisation. */

export type ClientType = Enums<"client_type">;

export type InvoiceListItem = {
  id: string;
  number: string;
  debtorId: string;
  debtorName: string;
  clientType: ClientType;
  amountTtc: number;
  currency: string;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  status: InvoiceStatus;
  daysOverdue: number;
};

export type InvoiceList = {
  items: InvoiceListItem[];
  total: number;
  pageCount: number;
  counts: Record<InvoiceFilter, number>;
};

const SORT_BY_FILTER: Record<InvoiceFilter, "due_asc" | "paid_desc" | "issued_desc"> = {
  open: "due_asc",
  late: "due_asc",
  promised: "due_asc",
  disputed: "due_asc",
  paid: "paid_desc",
  cancelled: "issued_desc",
  all: "issued_desc",
};

function countsByFilter(rows: ReadonlyArray<{ status: InvoiceStatus; invoice_count: number }>) {
  const byStatus = new Map(rows.map((row) => [row.status, row.invoice_count]));
  const entries = (Object.keys(INVOICE_FILTERS) as InvoiceFilter[]).map((filter) => {
    const statuses = INVOICE_FILTERS[filter].statuses;
    const count = statuses
      ? statuses.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0)
      : rows.reduce((sum, row) => sum + row.invoice_count, 0);
    return [filter, count] as const;
  });
  return Object.fromEntries(entries) as Record<InvoiceFilter, number>;
}

export async function listInvoices({ filter, search, page }: InvoiceListQuery): Promise<InvoiceList> {
  const supabase = await createSupabaseServerClient();
  const statuses = INVOICE_FILTERS[filter].statuses;
  const [list, counts] = await Promise.all([
    supabase.rpc("list_invoices", {
      ...(statuses ? { p_statuses: [...statuses] } : {}),
      p_search: search,
      p_sort: SORT_BY_FILTER[filter],
      p_limit: INVOICES_PAGE_SIZE,
      p_offset: (page - 1) * INVOICES_PAGE_SIZE,
    }),
    supabase.rpc("invoice_status_counts"),
  ]);
  const error = list.error ?? counts.error;
  if (error) throw new Error(`Lecture des factures impossible : ${error.message}`);

  const today = todayInParis();
  const rows = list.data ?? [];
  const total = rows[0]?.total_count ?? 0;
  return {
    items: rows.map((row) => ({
      id: row.id,
      number: row.number,
      debtorId: row.debtor_id,
      debtorName: row.debtor_name,
      clientType: row.client_type,
      amountTtc: Number(row.amount_ttc),
      currency: row.currency,
      issuedAt: row.issued_at,
      dueAt: row.due_at,
      paidAt: row.paid_at ?? null,
      status: row.status,
      daysOverdue: row.status === "late" ? daysOverdue(row.due_at, today) : 0,
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / INVOICES_PAGE_SIZE)),
    counts: countsByFilter(counts.data ?? []),
  };
}

// ─── Détail ─────────────────────────────────────────────────────────────────────

const INVOICE_DETAIL_COLUMNS = `
  id, number, amount_ht, amount_ttc, currency, issued_at, due_at, paid_at, status, source, factur_x_raw, created_at,
  reminders_paused_at,
  debtor:debtors (id, name, client_type, siren, contact_email),
  reminders!reminders_invoice_fkey (id, scheduled_at, sent_at, status, subject, ai_generated),
  promises!promises_invoice_fkey (id, promised_amount, promised_date, source, kept, created_at),
  replies!replies_invoice_fkey (id, kind, status, received_at, excerpt, ai_classified)
`;

export type InvoiceDetail = {
  id: string;
  number: string;
  amountHt: number;
  amountTtc: number;
  currency: string;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  /** Statut enregistré ; `status` est le statut effectif (en retard si l'échéance est passée). */
  storedStatus: InvoiceStatus;
  status: InvoiceStatus;
  daysOverdue: number;
  source: Enums<"invoice_source">;
  facturX: { profile: string | null } | null;
  createdAt: string;
  /** Relances suspendues depuis cette date : le client a répondu (§5.6). */
  remindersPausedAt: string | null;
  debtor: { id: string; name: string; clientType: ClientType; siren: string | null; contactEmail: string | null };
  reminders: Array<{
    id: string;
    scheduledAt: string;
    sentAt: string | null;
    status: Enums<"reminder_status">;
    subject: string | null;
    isAiGenerated: boolean;
  }>;
  promises: Array<{
    id: string;
    promisedAmount: number | null;
    promisedDate: string;
    source: Enums<"promise_source">;
    kept: boolean | null;
  }>;
  replies: Array<{
    id: string;
    kind: Enums<"reply_kind">;
    status: Enums<"reply_status">;
    receivedAt: string;
    excerpt: string | null;
    isAiClassified: boolean;
  }>;
};

const uuidSchema = z.uuid();

function facturXSummary(raw: Json | null): InvoiceDetail["facturX"] {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return { profile: typeof raw.profile === "string" ? raw.profile : null };
}

/**
 * Facture de l'organisation, ou null si elle n'existe pas (ou appartient à une autre organisation).
 * Mémorisée pour la durée d'une requête : métadonnées et page ne refont pas la lecture.
 */
export const getInvoice = cache(async (id: string): Promise<InvoiceDetail | null> => {
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_DETAIL_COLUMNS)
    .eq("id", id)
    .order("scheduled_at", { referencedTable: "reminders" })
    .order("created_at", { referencedTable: "promises", ascending: false })
    .order("received_at", { referencedTable: "replies", ascending: false })
    .maybeSingle();
  if (error) throw new Error(`Lecture de la facture impossible : ${error.message}`);
  if (!data?.debtor) return null;

  const today = todayInParis();
  const status = effectiveStatus(data.status, data.due_at, today);
  return {
    id: data.id,
    number: data.number,
    amountHt: Number(data.amount_ht),
    amountTtc: Number(data.amount_ttc),
    currency: data.currency,
    issuedAt: data.issued_at,
    dueAt: data.due_at,
    paidAt: data.paid_at,
    storedStatus: data.status,
    status,
    daysOverdue: status === "late" ? daysOverdue(data.due_at, today) : 0,
    source: data.source,
    facturX: facturXSummary(data.factur_x_raw),
    createdAt: data.created_at,
    remindersPausedAt: data.reminders_paused_at,
    debtor: {
      id: data.debtor.id,
      name: data.debtor.name,
      clientType: data.debtor.client_type,
      siren: data.debtor.siren,
      contactEmail: data.debtor.contact_email,
    },
    reminders: data.reminders.map((reminder) => ({
      id: reminder.id,
      scheduledAt: reminder.scheduled_at,
      sentAt: reminder.sent_at,
      status: reminder.status,
      subject: reminder.subject,
      isAiGenerated: reminder.ai_generated,
    })),
    promises: data.promises.map((promise) => ({
      id: promise.id,
      promisedAmount: promise.promised_amount === null ? null : Number(promise.promised_amount),
      promisedDate: promise.promised_date,
      source: promise.source,
      kept: promise.kept,
    })),
    replies: data.replies.map((reply) => ({
      id: reply.id,
      kind: reply.kind,
      status: reply.status,
      receivedAt: reply.received_at,
      excerpt: reply.excerpt,
      isAiClassified: reply.ai_classified,
    })),
  };
});

// ─── Écritures ──────────────────────────────────────────────────────────────────

export type ImportSummary = { created: number; invoiceIds: string[]; debtorsCreated: number; skipped: string[] };
export type MutationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const importResultSchema = z.object({
  created: z.number(),
  invoice_ids: z.array(z.string()),
  debtors_created: z.number(),
  skipped: z.array(z.string()),
});

const IMPORT_FAILED = "L'import n'a pas pu être enregistré. Aucune facture n'a été créée.";

/** Import en une transaction (CSV, Factur-X, saisie) : tout ou rien. Les numéros existants sont ignorés. */
export async function importInvoices(
  rows: readonly ImportRow[],
  source: "manual" | "csv" | "facturx",
): Promise<MutationResult<ImportSummary>> {
  const batch = importBatchSchema.safeParse(rows);
  if (!batch.success) return { ok: false, error: batch.error.issues[0]?.message ?? IMPORT_FAILED };
  // Le résumé structuré n'a de sens que pour une facture électronique.
  if (source !== "facturx" && batch.data.some((row) => row.facturXRaw !== null)) {
    return { ok: false, error: IMPORT_FAILED };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("import_invoices", {
    p_rows: batch.data.map(toRpcRow),
    p_source: source,
  });
  if (error) {
    console.error("Import de factures refusé par la base", { code: error.code, message: error.message });
    // 23505 : un autre import a créé le même numéro entre-temps.
    return { ok: false, error: error.code === "23505" ? `${IMPORT_FAILED} Réessayez.` : IMPORT_FAILED };
  }

  const result = importResultSchema.parse(data);
  return {
    ok: true,
    value: {
      created: result.created,
      invoiceIds: result.invoice_ids,
      debtorsCreated: result.debtors_created,
      skipped: result.skipped,
    },
  };
}

export async function changeInvoiceStatus(
  id: string,
  action: StatusAction,
  paidAt: string | null,
): Promise<MutationResult<InvoiceStatus>> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Facture introuvable." };
  const supabase = await createSupabaseServerClient();
  const { data: invoice, error: readError } = await supabase
    .from("invoices")
    .select("status, due_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw new Error(`Lecture de la facture impossible : ${readError.message}`);
  if (!invoice) return { ok: false, error: "Facture introuvable." };

  const change = nextStatus(action, { status: invoice.status, dueAt: invoice.due_at }, todayInParis(), paidAt);
  if (!change.ok) return change;

  // La base applique les mêmes transitions et verrouille la facture : un changement simultané
  // (autre membre, cron) fait échouer celui-ci au lieu de l'écraser.
  const { data: status, error } = await supabase.rpc("change_invoice_status", {
    p_invoice_id: id,
    p_action: action,
    ...(change.paidAt ? { p_paid_at: change.paidAt } : {}),
  });
  if (error?.code === "22023") {
    return { ok: false, error: "La facture a été modifiée entre-temps. Rechargez la page." };
  }
  if (error?.code === "P0002") return { ok: false, error: "Facture introuvable." };
  if (error) throw new Error(`Mise à jour du statut impossible : ${error.message}`);
  return { ok: true, value: status };
}
