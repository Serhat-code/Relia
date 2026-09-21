"use server";

import { revalidatePath } from "next/cache";
import { clearSampleData, loadSampleData, type SampleMutation } from "@/lib/data/sample-data";
import { requireMember } from "@/lib/data/session";

/** Jeu d'essai (§1) : charger ou effacer, réservé au propriétaire et aux administrateurs. */

const ROLE_ERROR = "Seuls le propriétaire et les administrateurs peuvent gérer le jeu d'essai.";

/** Les écrans concernés : tableau de bord, factures, débiteurs. */
function refreshAppPages() {
  revalidatePath("/app", "layout");
}

export async function loadSampleDataAction(): Promise<SampleMutation> {
  const member = await requireMember();
  if (member.role === "member") return { ok: false, error: ROLE_ERROR };

  const result = await loadSampleData();
  if (result.ok) refreshAppPages();
  return result;
}

export async function clearSampleDataAction(): Promise<SampleMutation> {
  const member = await requireMember();
  if (member.role === "member") return { ok: false, error: ROLE_ERROR };

  const result = await clearSampleData();
  if (result.ok) refreshAppPages();
  return result;
}
