import { describe, expect, it } from "vitest";
import { parseListQuery, sanitizeSearch } from "./list-query";
import { availableActions, nextStatus } from "./transitions";

const TODAY = "2026-09-18";

describe("availableActions", () => {
  it("propose de régler, contester ou annuler une facture ouverte", () => {
    expect(availableActions("late")).toEqual(["mark_paid", "mark_disputed", "cancel"]);
    expect(availableActions("pending")).toEqual(["mark_paid", "mark_disputed", "cancel"]);
  });

  it("une facture en litige peut être réglée, annulée ou rouverte, mais pas contestée à nouveau", () => {
    expect(availableActions("disputed")).toEqual(["mark_paid", "cancel", "reopen"]);
  });

  it("une facture payée ou annulée ne peut qu'être rouverte", () => {
    expect(availableActions("paid")).toEqual(["reopen"]);
    expect(availableActions("cancelled")).toEqual(["reopen"]);
  });
});

describe("nextStatus", () => {
  const late = { status: "late", dueAt: "2026-08-31" } as const;

  it("marque payée à la date indiquée", () => {
    expect(nextStatus("mark_paid", late, TODAY, "2026-09-15")).toEqual({ ok: true, status: "paid", paidAt: "2026-09-15" });
  });

  it("exige une date de règlement valide et passée", () => {
    expect(nextStatus("mark_paid", late, TODAY, null)).toEqual({ ok: false, error: "Indiquez la date du règlement." });
    expect(nextStatus("mark_paid", late, TODAY, "2026-09-19")).toEqual({
      ok: false,
      error: "La date du règlement ne peut pas être dans le futur.",
    });
  });

  it("rouvre une facture en retard ou en attente selon son échéance", () => {
    expect(nextStatus("reopen", { status: "paid", dueAt: "2026-08-31" }, TODAY)).toEqual({
      ok: true,
      status: "late",
      paidAt: null,
    });
    expect(nextStatus("reopen", { status: "cancelled", dueAt: "2026-10-31" }, TODAY)).toEqual({
      ok: true,
      status: "pending",
      paidAt: null,
    });
  });

  it("refuse une action impossible depuis le statut actuel", () => {
    expect(nextStatus("mark_disputed", { status: "paid", dueAt: "2026-08-31" }, TODAY)).toEqual({
      ok: false,
      error: "Cette action n'est pas possible pour une facture « Payée ».",
    });
  });
});

describe("parseListQuery", () => {
  it("par défaut : factures à encaisser, première page, sans recherche", () => {
    expect(parseListQuery({})).toEqual({ filter: "open", search: "", page: 1 });
  });

  it("lit l'onglet, la recherche et la page", () => {
    expect(parseListQuery({ statut: "payees", q: "  Caradec ", page: "3" })).toEqual({
      filter: "paid",
      search: "Caradec",
      page: 3,
    });
  });

  it("ignore les valeurs inconnues ou hors bornes plutôt que d'échouer", () => {
    expect(parseListQuery({ statut: "n-importe", page: "-2" })).toEqual({ filter: "open", search: "", page: 1 });
    expect(parseListQuery({ page: ["2", "5"], q: ["a", "b"] })).toEqual({ filter: "open", search: "a", page: 2 });
  });
});

describe("sanitizeSearch", () => {
  it("retire les caractères qui ont un sens dans les filtres de l'API", () => {
    expect(sanitizeSearch("F-2026,(or)*%\\")).toBe("F-2026 or");
  });

  it("garde l'apostrophe des noms courants", () => {
    expect(sanitizeSearch("L'Atelier")).toBe("L'Atelier");
  });

  it("borne la longueur", () => {
    expect(sanitizeSearch("x".repeat(500))).toHaveLength(100);
  });
});
