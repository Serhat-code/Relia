import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Étapes de prise en main (§5.1) ; compte et DPA sont acquis dès l'inscription. */
export type OnboardingProgress = {
  hasActiveMailbox: boolean;
  hasInvoices: boolean;
  /** Des données fictives cohabitent avec les vraies : l'écran doit le rappeler. */
  hasSampleData: boolean;
};

export async function getOnboardingProgress(): Promise<OnboardingProgress> {
  const supabase = await createSupabaseServerClient();
  const [mailboxes, invoices, samples] = await Promise.all([
    supabase.from("email_accounts").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("invoices").select("id", { count: "exact", head: true }),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("is_sample", true),
  ]);
  const error = mailboxes.error ?? invoices.error ?? samples.error;
  if (error) throw new Error(`Lecture de la prise en main impossible : ${error.message}`);

  return {
    hasActiveMailbox: (mailboxes.count ?? 0) > 0,
    hasInvoices: (invoices.count ?? 0) > 0,
    hasSampleData: (samples.count ?? 0) > 0,
  };
}
