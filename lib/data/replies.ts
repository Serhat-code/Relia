import "server-only";
import { effectiveStatus, todayInParis } from "@/lib/invoices/dates";
import type { InvoiceStatus } from "@/lib/invoices/status";
import type { ReplyKind } from "@/lib/replies/labels";
import type { Enums } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Réponses des clients aux relances (lecture seule pour les membres ; traitement par fonctions dédiées). */

export type ReplyFilter = "new" | "handled";

export type ReplyItem = {
  id: string;
  kind: ReplyKind;
  status: Enums<"reply_status">;
  receivedAt: string;
  excerpt: string | null;
  isAiClassified: boolean;
  handledAt: string | null;
  invoice: { id: string; number: string; amountTtc: number; currency: string; dueAt: string; status: InvoiceStatus; isPaused: boolean };
  debtor: { id: string; name: string; email: string | null };
  /** Promesse enregistrée à partir de cette réponse. */
  promise: { date: string; amount: number | null; kept: boolean | null } | null;
};

const LIST_LIMIT = 100;

const REPLY_COLUMNS = `
  id, kind, status, received_at, excerpt, ai_classified, handled_at,
  invoice:invoices!replies_invoice_fkey (
    id, number, amount_ttc, currency, due_at, status, reminders_paused_at,
    debtor:debtors (id, name, contact_email)
  ),
  promises!promises_reply_fkey (promised_date, promised_amount, kept)
`;

export async function listReplies(filter: ReplyFilter): Promise<ReplyItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("replies")
    .select(REPLY_COLUMNS)
    .eq("status", filter)
    .order("received_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error(`Lecture des réponses impossible : ${error.message}`);

  const today = todayInParis();
  return data.flatMap((row) => {
    const invoice = row.invoice;
    const debtor = invoice?.debtor;
    if (!invoice || !debtor) return [];
    const promise = row.promises[0];
    return [
      {
        id: row.id,
        kind: row.kind,
        status: row.status,
        receivedAt: row.received_at,
        excerpt: row.excerpt,
        isAiClassified: row.ai_classified,
        handledAt: row.handled_at,
        invoice: {
          id: invoice.id,
          number: invoice.number,
          amountTtc: Number(invoice.amount_ttc),
          currency: invoice.currency,
          dueAt: invoice.due_at,
          status: effectiveStatus(invoice.status, invoice.due_at, today),
          isPaused: invoice.reminders_paused_at !== null,
        },
        debtor: { id: debtor.id, name: debtor.name, email: debtor.contact_email },
        promise: promise
          ? {
              date: promise.promised_date,
              amount: promise.promised_amount === null ? null : Number(promise.promised_amount),
              kept: promise.kept,
            }
          : null,
      },
    ];
  });
}

export async function countRepliesByFilter(): Promise<Record<ReplyFilter, number>> {
  const supabase = await createSupabaseServerClient();
  const [waiting, handled] = await Promise.all(
    (["new", "handled"] as const).map((status) =>
      supabase.from("replies").select("id", { count: "exact", head: true }).eq("status", status),
    ),
  );
  const failed = waiting?.error ?? handled?.error;
  if (failed) throw new Error(`Lecture des réponses impossible : ${failed.message}`);
  return { new: waiting?.count ?? 0, handled: handled?.count ?? 0 };
}
