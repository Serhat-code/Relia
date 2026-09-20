import { describe, expect, it } from "vitest";
import { entryLink, JOURNAL_CATEGORIES, journalCategory } from "./categories";

const INVOICE = "00000000-0000-4000-8000-000000000412";
const DEBTOR = "00000000-0000-4000-8000-000000000001";

describe("journalCategory", () => {
  it("retrouve un thème par son identifiant d'URL, sinon « Tout »", () => {
    expect(journalCategory("reponses").label).toBe("Réponses et promesses");
    expect(journalCategory("inconnu").slug).toBe("tout");
    expect(journalCategory(undefined).filter).toBeNull();
  });

  it("chaque thème a un identifiant unique", () => {
    const slugs = JOURNAL_CATEGORIES.map((category) => category.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("entryLink", () => {
  it("renvoie vers la facture ou le client concerné", () => {
    expect(entryLink({ action: "invoice.status_changed", entityType: "invoice", entityId: INVOICE, payload: {} })).toEqual({
      href: `/app/factures/${INVOICE}`,
      label: "Voir la facture",
    });
    expect(entryLink({ action: "debtor.updated", entityType: "debtor", entityId: DEBTOR, payload: {} })?.href).toBe(
      `/app/debiteurs/${DEBTOR}`,
    );
  });

  it("passe par la facture pour une relance, une réponse ou une promesse", () => {
    expect(entryLink({ action: "reply.received", entityType: "reply", entityId: DEBTOR, payload: { invoice_id: INVOICE } })?.href).toBe(
      `/app/factures/${INVOICE}`,
    );
  });

  it("aucun lien vers un client effacé, un import, ou un identifiant douteux", () => {
    expect(entryLink({ action: "debtor.deleted", entityType: "debtor", entityId: DEBTOR, payload: {} })).toBeNull();
    expect(entryLink({ action: "invoices.imported", entityType: "invoice", entityId: null, payload: {} })).toBeNull();
    expect(entryLink({ action: "reminder.sent", entityType: "reminder", entityId: null, payload: { invoice_id: "../admin" } })).toBeNull();
  });
});
