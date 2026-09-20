import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Limitation de débit fondée sur le journal d'audit : chaque tentative (réussie ou non) y est tracée,
 * et le nombre de tentatives récentes d'une organisation sert de compteur. Pas d'infrastructure en
 * plus, et la trace des abus reste consultable.
 */

type Limit = { action: string; max: number; windowMinutes: number };

export const RATE_LIMITS = {
  /** E-mail de test : chaque essai part vraiment de la boîte du client (limites anti-spam). */
  mailboxTest: { action: "mailbox.tested", max: 5, windowMinutes: 10 },
  /** Vérification SMTP : une connexion sortante vers un serveur saisi par le client. */
  smtpCheck: { action: "mailbox.smtp_checked", max: 10, windowMinutes: 10 },
  /** Lecture des réponses à la demande : connexion à la messagerie et analyse par l'IA. */
  repliesCheck: { action: "replies.checked", max: 5, windowMinutes: 10 },
  /** Import CSV ou Factur-X (jusqu'à 2 000 factures chacun) : l'import se trace lui-même. */
  bulkImport: { action: "invoices.imported", max: 20, windowMinutes: 10 },
  /**
   * Invitations : `create_invitation` trace `team.invited`, qui sert donc de compteur. Généreux au
   * regard de la plus grande offre (10 utilisateurs), mais borne une écriture autrement libre.
   */
  teamInvite: { action: "team.invited", max: 10, windowMinutes: 60 },
} as const satisfies Record<string, Limit>;

export async function isRateLimited(organizationId: string, limit: Limit): Promise<boolean> {
  const since = new Date(Date.now() - limit.windowMinutes * 60_000).toISOString();
  const { count, error } = await createSupabaseAdminClient()
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("action", limit.action)
    .gte("created_at", since);
  if (error) {
    // Sans compteur fiable, on refuse plutôt que d'ouvrir la porte.
    console.error("Limitation de débit : lecture impossible", { message: error.message });
    return true;
  }
  return (count ?? 0) >= limit.max;
}

export async function recordAttempt(
  organizationId: string,
  userId: string,
  limit: Limit,
  payload: Record<string, string | boolean>,
): Promise<void> {
  const { error } = await createSupabaseAdminClient().from("audit_logs").insert({
    organization_id: organizationId,
    actor_type: "user",
    actor_id: userId,
    action: limit.action,
    entity_type: "mailbox",
    payload,
  });
  if (error) console.error("Journal d'audit : écriture impossible", { action: limit.action, message: error.message });
}
