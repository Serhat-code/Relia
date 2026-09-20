import "server-only";
import type { PlanUsage } from "@/lib/billing/limits";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Consommation de l'offre : membres de l'équipe et factures suivies. La RLS limite d'elle-même les
 * deux décomptes à l'organisation du membre. Deux comptages, pas de fonction en base : rien ici ne
 * justifie une migration.
 *
 * « Factures suivies » = celles sur lesquelles Relia travaille encore. Une facture réglée, annulée
 * ou contestée ne mobilise plus rien et ne compte donc pas.
 */

const TRACKED_STATUSES = ["pending", "late", "promised"] as const;

export async function getPlanUsage(): Promise<PlanUsage> {
  const supabase = await createSupabaseServerClient();
  const [users, invoices] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("invoices").select("id", { count: "exact", head: true }).in("status", [...TRACKED_STATUSES]),
  ]);

  if (users.error || invoices.error) {
    // Un décompte illisible ne doit pas faire échouer une page : on n'avertit simplement pas.
    console.error("Consommation de l'offre illisible", { message: (users.error ?? invoices.error)?.message });
    return { users: 0, invoices: 0 };
  }
  return { users: users.count ?? 0, invoices: invoices.count ?? 0 };
}
