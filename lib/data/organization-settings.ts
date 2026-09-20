import "server-only";
import type { OrganizationSettings } from "@/lib/organization/settings-form";
import type { Enums } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Réglages de l'organisation. La RLS réserve la modification au propriétaire et aux administrateurs,
 * et seules les colonnes nom, SIREN et durée de conservation sont modifiables par un membre.
 */

export type TeamMember = { id: string; name: string | null; email: string; role: Enums<"member_role">; joinedAt: string };

export async function listTeam(): Promise<TeamMember[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("users").select("id, full_name, email, role, created_at").order("created_at");
  if (error) throw new Error(`Lecture de l'équipe impossible : ${error.message}`);
  return data.map((member) => ({
    id: member.id,
    name: member.full_name,
    email: member.email,
    role: member.role,
    joinedAt: member.created_at,
  }));
}

export type SettingsMutation = { ok: true } | { ok: false; error: string };

type Actor = { organizationId: string; userId: string };

async function update(
  actor: Actor,
  values: { name?: string; siren?: string | null; retention_months?: number; default_currency?: string },
  action: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organizations").update(values).eq("id", actor.organizationId).select("id");
  if (error || data.length === 0) {
    if (error) console.error("Réglages de l'organisation refusés", { code: error.code, message: error.message });
    return { ok: false, error: "Seuls le propriétaire et les administrateurs peuvent modifier ces réglages." } as const;
  }
  const { error: auditError } = await supabase.from("audit_logs").insert({
    organization_id: actor.organizationId,
    actor_type: "user",
    actor_id: actor.userId,
    action,
    entity_type: "organization",
    entity_id: actor.organizationId,
    payload: { fields: Object.keys(values) },
  });
  if (auditError) console.error("Journal d'audit : écriture impossible", { action, message: auditError.message });
  return { ok: true } as const;
}

export function updateOrganizationSettings(actor: Actor, settings: OrganizationSettings): Promise<SettingsMutation> {
  return update(
    actor,
    { name: settings.name, siren: settings.siren, default_currency: settings.currency },
    "organization.updated",
  );
}

export function updateRetentionMonths(actor: Actor, months: number): Promise<SettingsMutation> {
  return update(actor, { retention_months: months }, "organization.retention_changed");
}
