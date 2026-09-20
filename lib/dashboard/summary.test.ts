import { describe, expect, it } from "vitest";
import { computeDso, parseDashboardSummary } from "./summary";

const RAW = {
  open_amount: 2400,
  open_count: 5,
  late_amount: 900,
  late_count: 3,
  promised_amount: 500,
  promised_count: 1,
  billed_90_days: 2600,
  aging: [200, 300, 0, 400],
  at_risk: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      number: "A-4",
      amount_ttc: "400.00",
      currency: "EUR",
      due_at: "2026-05-24",
      debtor_id: "00000000-0000-4000-8000-000000000002",
      debtor_name: "Menuiserie Caradec",
      risk_score: 72,
    },
  ],
};

describe("computeDso", () => {
  it("rapporte l'encours au facturé des 90 derniers jours", () => {
    expect(computeDso(2400, 2600)).toBe(83);
    expect(computeDso(0, 2600)).toBe(0);
  });

  it("n'a pas de sens sans facturation récente", () => {
    expect(computeDso(2400, 0)).toBeNull();
  });
});

describe("parseDashboardSummary", () => {
  it("lit la synthèse de la base et en déduit le non échu, le DSO et les parts de retard", () => {
    const summary = parseDashboardSummary(RAW);

    expect(summary).toMatchObject({ openAmount: 2400, lateAmount: 900, promisedAmount: 500, notDueAmount: 1000, dso: 83 });
    expect(summary?.aging.map((bucket) => [bucket.label, bucket.amount, Math.round(bucket.share * 100)])).toEqual([
      ["1 à 30 jours", 200, 22],
      ["31 à 60 jours", 300, 33],
      ["61 à 90 jours", 0, 0],
      ["Plus de 90 jours", 400, 44],
    ]);
    expect(summary?.atRisk[0]).toEqual({
      id: RAW.at_risk[0]?.id,
      number: "A-4",
      amountTtc: 400,
      currency: "EUR",
      dueAt: "2026-05-24",
      debtor: { id: RAW.at_risk[0]?.debtor_id, name: "Menuiserie Caradec" },
      riskScore: 72,
    });
  });

  it("sans retard, les parts sont nulles plutôt qu'indéfinies", () => {
    expect(parseDashboardSummary({ ...RAW, aging: [0, 0, 0, 0] })?.aging.every((bucket) => bucket.share === 0)).toBe(true);
  });

  it("refuse une réponse inattendue plutôt que d'afficher des chiffres faux", () => {
    expect(parseDashboardSummary({ ...RAW, aging: [1, 2] })).toBeNull();
    expect(parseDashboardSummary(null)).toBeNull();
  });
});
