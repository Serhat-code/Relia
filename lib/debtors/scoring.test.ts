import { describe, expect, it } from "vitest";
import { describePaymentBehavior, describeRisk, isScoringEligible, scoreForDisplay } from "./scoring";

describe("isScoringEligible (§2.4)", () => {
  it("seule une personne morale identifiée peut être notée", () => {
    expect(isScoringEligible({ clientType: "b2b", siren: "123456782", isLegalEntity: true })).toBe(true);
  });

  it("jamais un particulier, un entrepreneur individuel ou un professionnel sans SIREN", () => {
    expect(isScoringEligible({ clientType: "b2c", siren: "123456782", isLegalEntity: true })).toBe(false);
    expect(isScoringEligible({ clientType: "b2b", siren: "123456782", isLegalEntity: false })).toBe(false);
    expect(isScoringEligible({ clientType: "b2b", siren: null, isLegalEntity: true })).toBe(false);
  });
});

describe("scoreForDisplay", () => {
  const legalEntity = { clientType: "b2b", siren: "123456782", isLegalEntity: true } as const;

  it("affiche « Non applicable » hors personne morale, quel que soit le score reçu", () => {
    expect(scoreForDisplay({ clientType: "b2c", siren: null, isLegalEntity: false }, 80)).toEqual({ kind: "not_applicable" });
  });

  it("distingue l'absence d'historique d'un score", () => {
    expect(scoreForDisplay(legalEntity, null)).toEqual({ kind: "no_history" });
    expect(scoreForDisplay(legalEntity, 62)).toEqual({ kind: "score", score: 62, level: "high" });
  });
});

describe("describeRisk", () => {
  it("classe le score en trois niveaux", () => {
    expect(describeRisk(10)).toBe("low");
    expect(describeRisk(35)).toBe("moderate");
    expect(describeRisk(60)).toBe("high");
  });
});

describe("describePaymentBehavior", () => {
  it("décrit le retard moyen, l'avance ou la ponctualité", () => {
    expect(describePaymentBehavior(12)).toBe("Règle en moyenne 12 jours après l'échéance.");
    expect(describePaymentBehavior(-1)).toBe("Règle en moyenne 1 jour avant l'échéance.");
    expect(describePaymentBehavior(0)).toBe("Règle en moyenne à l'échéance.");
    expect(describePaymentBehavior(null)).toBe("Aucune facture réglée pour l'instant.");
  });
});
