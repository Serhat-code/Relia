import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { Reveal } from "@/components/motion/Reveal";
import { Card, CardContent } from "@/components/ui/Card";
import { listDebtorSuggestions } from "@/lib/data/debtors";
import { todayInParis } from "@/lib/invoices/dates";

export const metadata: Metadata = { title: "Nouvelle facture" };

export default async function NewInvoicePage() {
  const debtors = await listDebtorSuggestions();

  return (
    <>
      <PageHeader
        title="Nouvelle facture"
        description="Saisissez une facture déjà émise : Relia suivra son règlement et préparera les relances."
      />
      <Reveal index={1} className="max-w-3xl">
        <Card>
          <CardContent>
            <InvoiceForm today={todayInParis()} debtors={debtors} />
          </CardContent>
        </Card>
      </Reveal>
    </>
  );
}
