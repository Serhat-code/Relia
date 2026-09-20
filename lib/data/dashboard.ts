import "server-only";
import { parseDashboardSummary, type DashboardSummary } from "@/lib/dashboard/summary";
import { todayInParis } from "@/lib/invoices/dates";
import { parisTimeToUtc } from "@/lib/reminders/planner";
import { readsReplies } from "@/lib/mail/replies-reading";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listActivitySince, type AuditEntry } from "./audit";
import { getMailbox } from "./mailbox";

/** Tableau de bord (§5.7) : chiffres calculés par la base, ce qui attend le client, activité du jour. */

export type DashboardTodo = {
  awaitingApproval: number;
  repliesToHandle: number;
  failedReminders: number;
  /** Boîte connectée sans serveur IMAP : les relances partent, mais aucune réponse n'est entendue. */
  isMissingReplyReading: boolean;
};

export type DashboardData = { summary: DashboardSummary; todo: DashboardTodo; activity: AuditEntry[] };

const ACTIVITY_LIMIT = 12;

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createSupabaseServerClient();
  const startOfDay = parisTimeToUtc(todayInParis(), 0, 0);
  const [summary, awaiting, replies, failed, activity, mailbox] = await Promise.all([
    supabase.rpc("dashboard_summary"),
    supabase.from("reminders").select("id", { count: "exact", head: true }).eq("status", "awaiting_approval"),
    supabase.from("replies").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("reminders").select("id", { count: "exact", head: true }).eq("status", "failed"),
    listActivitySince(startOfDay, ACTIVITY_LIMIT),
    getMailbox(),
  ]);
  const error = summary.error ?? awaiting.error ?? replies.error ?? failed.error;
  if (error) throw new Error(`Lecture du tableau de bord impossible : ${error.message}`);
  const parsed = parseDashboardSummary(summary.data);
  if (!parsed) throw new Error("Lecture du tableau de bord impossible : synthèse inattendue.");

  return {
    summary: parsed,
    todo: {
      awaitingApproval: awaiting.count ?? 0,
      repliesToHandle: replies.count ?? 0,
      failedReminders: failed.count ?? 0,
      // Une boîte encore à vérifier relève de la prise en main, pas d'un manque à corriger.
      isMissingReplyReading: mailbox?.status === "active" && !readsReplies(mailbox),
    },
    activity,
  };
}
