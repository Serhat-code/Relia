import { describe, expect, it } from "vitest";
import { findLimitOverrun, PLAN_LIMITS, planFeatures } from "./limits";
import { PLANS } from "./plans";

describe("findLimitOverrun", () => {
  it("ne dit rien tant que l'offre suffit, bornes comprises", () => {
    expect(findLimitOverrun("pro", { users: 3, invoices: 600 })).toBeNull();
    expect(findLimitOverrun("starter", { users: 1, invoices: 0 })).toBeNull();
  });

  it("signale l'équipe trop nombreuse avant les factures : c'est la cause la plus claire", () => {
    const overrun = findLimitOverrun("starter", { users: 2, invoices: 900 });

    expect(overrun?.kind).toBe("users");
    expect(overrun?.message).toBe("Votre équipe compte 2 utilisateurs, et l'offre en prévoit 1 utilisateur.");
  });

  it("signale les factures suivies au-delà de l'offre", () => {
    const overrun = findLimitOverrun("starter", { users: 1, invoices: 187 });

    expect(overrun).toMatchObject({ kind: "invoices", used: 187, allowed: 150 });
    expect(overrun?.message).toContain("187 factures en cours");
  });

  it("l'offre Business ne borne pas les factures", () => {
    expect(PLAN_LIMITS.business.invoices).toBeNull();
    expect(findLimitOverrun("business", { users: 10, invoices: 50_000 })).toBeNull();
    expect(findLimitOverrun("business", { users: 11, invoices: 0 })?.kind).toBe("users");
  });
});

describe("annonce commerciale et décompte", () => {
  it("chaque offre affiche exactement les limites qu'elle applique", () => {
    for (const plan of PLANS) {
      for (const line of planFeatures(plan.id)) {
        expect(plan.features, plan.id).toContain(line);
      }
    }
  });

  it("les limites croissent avec le prix", () => {
    expect(PLAN_LIMITS.starter.users).toBeLessThan(PLAN_LIMITS.pro.users);
    expect(PLAN_LIMITS.pro.users).toBeLessThan(PLAN_LIMITS.business.users);
    expect(PLAN_LIMITS.starter.invoices!).toBeLessThan(PLAN_LIMITS.pro.invoices!);
  });
});
