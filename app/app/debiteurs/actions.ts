"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deleteDebtor, updateDebtor } from "@/lib/data/debtors";
import { requireMember } from "@/lib/data/session";
import { DEBTOR_FORM_FIELDS, parseDebtorForm } from "@/lib/debtors/debtor-form";
import { readForm, type FormState } from "@/lib/forms/form-state";

/** Mutations des débiteurs. Chaque action vérifie la session : une Server Action est un point d'entrée public. */

const debtorIdSchema = z.uuid();

function refreshDebtorPages(debtorId?: string) {
  revalidatePath("/app/debiteurs");
  revalidatePath("/app/factures");
  if (debtorId) revalidatePath(`/app/debiteurs/${debtorId}`);
}

/** Liée à l'identifiant du débiteur côté page : `updateDebtorAction.bind(null, id)`. */
export async function updateDebtorAction(debtorId: string, _previous: FormState, formData: FormData): Promise<FormState> {
  await requireMember();
  if (!debtorIdSchema.safeParse(debtorId).success) return { status: "error", message: "Client introuvable." };

  const values = readForm(formData, DEBTOR_FORM_FIELDS);
  const parsed = parseDebtorForm(values);
  if (!parsed.ok) return { status: "error", fieldErrors: parsed.fieldErrors, values };

  const result = await updateDebtor(debtorId, parsed.debtor);
  if (!result.ok) return { status: "error", message: result.error, values };
  refreshDebtorPages(debtorId);
  return { status: "success", message: "Fiche enregistrée." };
}

export type DeleteDebtorResult = { ok: false; error: string };

/** Droit à l'effacement : réservé au propriétaire et aux administrateurs (vérifié aussi par la base). */
export async function deleteDebtorAction(input: unknown): Promise<DeleteDebtorResult> {
  const member = await requireMember();
  const parsed = z.object({ debtorId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  if (member.role === "member") {
    return { ok: false, error: "Seuls le propriétaire et les administrateurs peuvent effacer un client." };
  }

  const result = await deleteDebtor(parsed.data.debtorId);
  if (!result.ok) return result;
  refreshDebtorPages();
  redirect("/app/debiteurs?efface=1");
}
