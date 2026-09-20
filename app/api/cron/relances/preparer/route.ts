import { isAuthorizedCron } from "@/lib/cron";
import { planRemindersForOrganization } from "@/lib/reminders/engine";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Chaque matin : recalcule les scores de risque (ils dépendent de la date), solde les promesses échues
 * de toutes les organisations (les factures redeviennent dues), puis prépare les relances du jour de
 * celles dont la boîte d'envoi est active.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Non autorisé", { status: 401 });

  const admin = createSupabaseAdminClient();
  const scores = await admin.rpc("refresh_all_debtor_stats");
  if (scores.error) console.error("Scores de risque non recalculés", { message: scores.error.message });
  const settled = await admin.rpc("settle_due_promises", {});
  if (settled.error) console.error("Promesses échues non soldées", { message: settled.error.message });

  const { data, error } = await admin
    .from("email_accounts")
    .select("organization_id")
    .eq("status", "active");
  if (error) return Response.json({ error: "Lecture des organisations impossible" }, { status: 500 });

  let planned = 0;
  for (const organizationId of new Set(data.map((row) => row.organization_id))) {
    try {
      planned += (await planRemindersForOrganization(organizationId)).planned;
    } catch (planningError) {
      console.error("Préparation des relances en échec", {
        organizationId,
        message: planningError instanceof Error ? planningError.message : "inconnu",
      });
    }
  }
  return Response.json({ planned });
}
