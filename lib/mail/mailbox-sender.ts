import "server-only";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { currentAccessToken, loadMailboxCredentials, markMailboxStatus, RECONNECT_MESSAGE } from "./mailbox-access";
import type { OutgoingMessage } from "./message";
import { sendWithGmail, sendWithGraph, sendWithSmtp, type SendResult } from "./senders";

/**
 * Envoi depuis la boîte de l'organisation (§2.1). Renouvelle le jeton d'accès s'il expire, et
 * marque la boîte « à reconnecter » si le fournisseur refuse l'accès (révocation, mot de passe changé).
 * Réservé au serveur (Server Actions après contrôle du membre, crons).
 */

export async function sendFromOrganizationMailbox(
  organizationId: string,
  message: Omit<OutgoingMessage, "from">,
  fallbackSenderName: string,
): Promise<SendResult> {
  // Adresse du destinataire vérifiée ici plutôt que confiée au seul comportement du fournisseur.
  if (!z.email().safeParse(message.to).success) {
    return { ok: false, error: "Adresse e-mail du destinataire invalide.", isAuthError: false };
  }
  const admin = createSupabaseAdminClient();
  const account = await loadMailboxCredentials(admin, organizationId);
  if (!account) return { ok: false, error: "Aucune boîte d'envoi n'est connectée.", isAuthError: false };

  const outgoing: OutgoingMessage = {
    ...message,
    from: { name: account.display_name ?? fallbackSenderName, address: account.email_address },
  };

  let result: SendResult;
  if (account.provider === "smtp") {
    if (!account.smtp_host || !account.smtp_port || !account.smtp_user || !account.smtp_password) {
      return { ok: false, error: "Configuration SMTP incomplète.", isAuthError: false };
    }
    result = await sendWithSmtp(
      { host: account.smtp_host, port: account.smtp_port, user: account.smtp_user, password: account.smtp_password },
      outgoing,
    );
  } else {
    const accessToken = await currentAccessToken(admin, organizationId, account);
    if (!accessToken) {
      await markMailboxStatus(admin, account.id, "error");
      return { ok: false, error: RECONNECT_MESSAGE, isAuthError: true };
    }
    result = account.provider === "gmail" ? await sendWithGmail(accessToken, outgoing) : await sendWithGraph(accessToken, outgoing);
  }

  if (result.ok) await markMailboxStatus(admin, account.id, "active");
  else if (result.isAuthError) await markMailboxStatus(admin, account.id, "error");
  return result;
}
