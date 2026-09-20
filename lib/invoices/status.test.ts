import { describe, expect, it } from "vitest";
import { INVOICE_STATUS_LABELS, INVOICE_STATUSES } from "./status";

describe("statuts de facture", () => {
  it("reprend les statuts du schéma (CLAUDE.md §4)", () => {
    expect(INVOICE_STATUSES).toEqual(["pending", "late", "promised", "paid", "disputed", "cancelled"]);
  });

  it("chaque statut a un libellé français", () => {
    expect(INVOICE_STATUS_LABELS).toEqual({
      pending: "En attente",
      late: "En retard",
      promised: "Promesse",
      paid: "Payée",
      disputed: "En litige",
      cancelled: "Annulée",
    });
  });
});
