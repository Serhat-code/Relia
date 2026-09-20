import { describe, expect, it } from "vitest";
import { daysOverdue, describeDue, effectiveStatus, todayInParis } from "./dates";
import { isAmbiguousAmount, parseAmount, parseDate } from "./parse";

describe("todayInParis", () => {
  it("donne la date du jour à Paris, même quand il est encore la veille en UTC", () => {
    expect(todayInParis(new Date("2026-09-30T22:30:00Z"))).toBe("2026-10-01");
  });
});

describe("effectiveStatus", () => {
  it("une facture en attente dont l'échéance est passée est en retard", () => {
    expect(effectiveStatus("pending", "2026-09-17", "2026-09-18")).toBe("late");
  });

  it("le jour de l'échéance, elle n'est pas encore en retard", () => {
    expect(effectiveStatus("pending", "2026-09-18", "2026-09-18")).toBe("pending");
  });

  it("les autres statuts ne changent pas", () => {
    expect(effectiveStatus("promised", "2026-09-01", "2026-09-18")).toBe("promised");
    expect(effectiveStatus("paid", "2026-09-01", "2026-09-18")).toBe("paid");
  });
});

describe("daysOverdue", () => {
  it("compte les jours depuis l'échéance, zéro avant", () => {
    expect(daysOverdue("2026-08-12", "2026-09-18")).toBe(37);
    expect(daysOverdue("2026-09-20", "2026-09-18")).toBe(0);
  });
});

describe("parseAmount", () => {
  it.each([
    ["1234,56", 1234.56],
    ["1 234,56 €", 1234.56],
    ["1 234,56 €", 1234.56],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["1234.5", 1234.5],
    ["4 280", 4280],
    ["EUR 99,9", 99.9],
    ["0", 0],
    // Aucun montant n'a trois décimales : un séparateur suivi de trois chiffres groupe les milliers.
    ["1.234", 1234],
    ["12,500", 12500],
    ["1,234,567", 1234567],
    ["1.234.567", 1234567],
    ["0,125", 0.13],
  ])("« %s » → %d", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(["", "abc", "12,34,56", "1.2.3", "-10"])("refuse « %s »", (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe("parseDate", () => {
  it.each([
    ["31/08/2026", "2026-08-31"],
    ["31-08-2026", "2026-08-31"],
    ["31.08.2026", "2026-08-31"],
    ["2026-08-31", "2026-08-31"],
    ["2026-08-31T10:00:00Z", "2026-08-31"],
    ["31/08/26", "2026-08-31"],
    ["1/9/2026", "2026-09-01"],
  ])("« %s » → %s", (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it.each(["", "31/02/2026", "2026-13-01", "demain"])("refuse « %s »", (input) => {
    expect(parseDate(input)).toBeNull();
  });
});

describe("describeDue", () => {
  const TODAY = "2026-09-18";

  it("compte les jours de retard", () => {
    expect(describeDue("2026-08-31", TODAY)).toEqual({ tone: "late", text: "18 jours de retard" });
    expect(describeDue("2026-09-17", TODAY)).toEqual({ tone: "late", text: "1 jour de retard" });
  });

  it("annonce une échéance proche ou lointaine", () => {
    expect(describeDue("2026-09-18", TODAY)).toEqual({ tone: "soon", text: "échéance aujourd'hui" });
    expect(describeDue("2026-09-19", TODAY)).toEqual({ tone: "soon", text: "demain" });
    expect(describeDue("2026-09-25", TODAY)).toEqual({ tone: "soon", text: "dans 7 jours" });
    expect(describeDue("2026-10-18", TODAY)).toEqual({ tone: "future", text: "dans 30 jours" });
  });
});

describe("isAmbiguousAmount", () => {
  it("signale un séparateur unique suivi de trois chiffres, lu comme des milliers", () => {
    expect(isAmbiguousAmount("1.234")).toBe(true);
    expect(isAmbiguousAmount("156,780")).toBe(true);
  });

  it("ne signale pas les écritures sans ambiguïté", () => {
    for (const raw of ["1 234,56", "1.234,56", "1234,5", "0,125", "1,234,567", "4 280", "abc"]) {
      expect(isAmbiguousAmount(raw)).toBe(false);
    }
  });
});
