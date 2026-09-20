import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProvisionInput = {
  userId: string;
  email: string;
  fullName: string;
  organizationName: string;
  siren: string;
  dpaVersion: string;
  dpaIp: string;
};

/**
 * Crée l'organisation d'un nouvel inscrit (DPA, membre propriétaire, scénarios par défaut, audit)
 * en une transaction, via la fonction SQL réservée à la clé de service. Idempotent.
 * `userId` doit venir de Supabase Auth (session ou réponse d'inscription), jamais du formulaire.
 */
export async function provisionOrganization(input: ProvisionInput): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("provision_organization", {
    p_user_id: input.userId,
    p_email: input.email,
    p_full_name: input.fullName,
    p_organization_name: input.organizationName,
    p_siren: input.siren,
    p_dpa_version: input.dpaVersion,
    p_dpa_ip: input.dpaIp,
  });
  if (error) throw new Error(`Création de l'organisation impossible : ${error.message}`);
  return data;
}
