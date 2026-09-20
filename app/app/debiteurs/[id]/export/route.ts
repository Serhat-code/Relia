import { exportDebtor, getDebtor } from "@/lib/data/debtors";
import { requireMember } from "@/lib/data/session";
import { exportFileName } from "@/lib/debtors/export";
import { todayInParis } from "@/lib/invoices/dates";

/**
 * Export des données d'un débiteur (droit d'accès, §2.2) : un fichier JSON lisible, téléchargé
 * par un membre de l'organisation. La RLS limite l'export à ses propres débiteurs ; l'export est tracé.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireMember();
  const { id } = await params;
  const [debtor, document] = await Promise.all([getDebtor(id), exportDebtor(id)]);
  if (!debtor || document === null) {
    return new Response("Client introuvable.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  return new Response(JSON.stringify(document, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(debtor.name, todayInParis())}"`,
      "Cache-Control": "no-store",
    },
  });
}
