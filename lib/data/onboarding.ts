import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Étapes de prise en main (§5.1) ; compte et DPA sont acquis dès l'inscription. */
export type OnboardingProgress = {
  hasActiveMailbox: boolean;
  hasInvoices: boolean;
};

export async function getOnboardingProgress(): Promise<OnboardingProgress> {
  const supabase = await createSupabaseServerClient();
  const [mailboxes, invoices] = await Promise.all([
    supabase.from("email_accounts").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("invoices").select("id", { count: "exact", head: true }),
  ]);
  const error = mailboxes.error ?? invoices.error;
  if (error) throw new Error(`Lecture de la prise en main impossible : ${error.message}`);

  return {
    hasActiveMailbox: (mailboxes.count ?? 0) > 0,
    hasInvoices: (invoices.count ?? 0) > 0,
  };
}
