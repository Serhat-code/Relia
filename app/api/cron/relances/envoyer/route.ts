import { isAuthorizedCron } from "@/lib/cron";
import { sendDueReminders } from "@/lib/reminders/dispatch";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Toutes les 15 minutes : envoie les relances dues, depuis la boîte de chaque client. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Non autorisé", { status: 401 });
  try {
    return Response.json(await sendDueReminders());
  } catch (error) {
    console.error("Envoi des relances en échec", { message: error instanceof Error ? error.message : "inconnu" });
    return Response.json({ error: "Envoi des relances impossible" }, { status: 500 });
  }
}
