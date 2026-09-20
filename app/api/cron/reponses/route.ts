import { isAuthorizedCron } from "@/lib/cron";
import { checkRepliesForOrganization } from "@/lib/replies/inbox";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Toutes les 30 minutes : lit les réponses des clients dans la boîte de chaque organisation (§5.6). */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Non autorisé", { status: 401 });

  const { data, error } = await createSupabaseAdminClient()
    .from("email_accounts")
    .select("organization_id")
    .eq("status", "active");
  if (error) return Response.json({ error: "Lecture des organisations impossible" }, { status: 500 });

  const totals = { organizations: 0, recorded: 0, failed: 0 };
  for (const organizationId of new Set(data.map((row) => row.organization_id))) {
    try {
      const summary = await checkRepliesForOrganization(organizationId);
      if (summary.status === "checked") {
        totals.organizations += 1;
        totals.recorded += summary.recorded;
      } else if (summary.status === "failed") {
        totals.failed += 1;
      }
    } catch (checkError) {
      totals.failed += 1;
      console.error("Lecture des réponses en échec", {
        organizationId,
        message: checkError instanceof Error ? checkError.message : "inconnu",
      });
    }
  }
  return Response.json(totals);
}
