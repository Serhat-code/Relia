import "server-only";
import type { ClientType } from "@/lib/debtors/client-type";
import type { Enums } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ReminderTone } from "@/lib/templates/system-templates";

/** File des relances de l'organisation (lecture seule pour les membres ; écriture par fonctions dédiées). */

export type ReminderFilter = "awaiting" | "scheduled" | "sent" | "failed";

const STATUSES_BY_FILTER: Readonly<Record<ReminderFilter, Enums<"reminder_status">[]>> = {
  awaiting: ["awaiting_approval"],
  scheduled: ["scheduled"],
  sent: ["sent"],
  failed: ["failed"],
};

export type ReminderItem = {
  id: string;
  status: Enums<"reminder_status">;
  scheduledAt: string;
  sentAt: string | null;
  subject: string;
  body: string;
  isAiGenerated: boolean;
  error: string | null;
  tone: ReminderTone | null;
  invoice: { id: string; number: string; amountTtc: number; currency: string; dueAt: string };
  debtor: { id: string; name: string; clientType: ClientType; email: string | null };
};

const LIST_LIMIT = 100;

export async function listReminders(filter: ReminderFilter): Promise<ReminderItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reminders")
    .select(
      `id, status, scheduled_at, sent_at, subject, body, ai_generated, error,
       step:reminder_steps (tone),
       invoice:invoices!reminders_invoice_fkey (id, number, amount_ttc, currency, due_at, debtor:debtors (id, name, client_type, contact_email))`,
    )
    .in("status", STATUSES_BY_FILTER[filter])
    .order(filter === "sent" ? "sent_at" : "scheduled_at", { ascending: filter !== "sent" })
    .limit(LIST_LIMIT);
  if (error) throw new Error(`Lecture des relances impossible : ${error.message}`);

  return data.flatMap((row) => {
    const invoice = row.invoice;
    const debtor = invoice?.debtor;
    if (!invoice || !debtor) return [];
    return [
      {
        id: row.id,
        status: row.status,
        scheduledAt: row.scheduled_at,
        sentAt: row.sent_at,
        subject: row.subject ?? "",
        body: row.body ?? "",
        isAiGenerated: row.ai_generated,
        error: row.error,
        tone: row.step?.tone ?? null,
        invoice: {
          id: invoice.id,
          number: invoice.number,
          amountTtc: Number(invoice.amount_ttc),
          currency: invoice.currency,
          dueAt: invoice.due_at,
        },
        debtor: { id: debtor.id, name: debtor.name, clientType: debtor.client_type, email: debtor.contact_email },
      },
    ];
  });
}

export async function countRemindersByFilter(): Promise<Record<ReminderFilter, number>> {
  const supabase = await createSupabaseServerClient();
  const filters = Object.keys(STATUSES_BY_FILTER) as ReminderFilter[];
  const results = await Promise.all(
    filters.map((filter) =>
      supabase.from("reminders").select("id", { count: "exact", head: true }).in("status", STATUSES_BY_FILTER[filter]),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(`Lecture des relances impossible : ${failed.error.message}`);
  return Object.fromEntries(filters.map((filter, index) => [filter, results[index]?.count ?? 0])) as Record<ReminderFilter, number>;
}
