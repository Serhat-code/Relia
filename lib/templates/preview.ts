import type { ClientType } from "@/lib/debtors/client-type";
import { addDays } from "@/lib/invoices/dates";
import type { RenderContext } from "./engine";

/** Facture fictive pour l'aperçu d'un modèle : échue depuis 15 jours. */
export function previewContext(clientType: ClientType, organizationName: string, today: string): RenderContext {
  return {
    debtor:
      clientType === "b2b"
        ? { clientType, name: "Menuiserie Caradec & Fils", contactName: "Yann Caradec" }
        : { clientType, name: "Camille Martin", contactName: "Camille Martin" },
    invoice: {
      number: "F-2026-042",
      amountTtc: 1200,
      currency: "EUR",
      issuedAt: addDays(today, -45),
      dueAt: addDays(today, -15),
    },
    organizationName,
    today,
  };
}
