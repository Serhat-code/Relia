import { isAuthorizedCron } from "@/lib/cron";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Chaque dimanche (4 h) : efface, pour chaque organisation, les factures closes depuis plus longtemps
 * que sa durée de conservation (avec relances, réponses et promesses), les débiteurs devenus sans
 * facture et le journal plus ancien (§2.2). Chaque purge est tracée, sans donnée personnelle.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Non autorisé", { status: 401 });

  const { data, error } = await createSupabaseAdminClient().rpc("purge_expired_data");
  if (error) {
    console.error("Purge en échec", { message: error.message });
    return Response.json({ error: "Purge impossible" }, { status: 500 });
  }
  return Response.json(data);
}
