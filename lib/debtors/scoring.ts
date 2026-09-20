import type { ClientType } from "./client-type";

/**
 * Score de risque de retard (§2.4). Calculé par la base (private.debtor_risk_score) sur le seul
 * historique de l'organisation avec ce débiteur ; la couche métier applique la même règle
 * d'éligibilité et n'affiche jamais un score hors personne morale identifiée.
 */

type ScoringIdentity = { clientType: ClientType; siren: string | null; isLegalEntity: boolean };

/** Même règle que private.is_scoring_eligible : B2B, SIREN renseigné, personne morale. */
export function isScoringEligible({ clientType, siren, isLegalEntity }: ScoringIdentity): boolean {
  return clientType === "b2b" && siren !== null && siren !== "" && isLegalEntity;
}

/** Pondérations du score, pour l'expliquer à l'utilisateur (transparence). */
export const RISK_SCORE_FACTORS = [
  { points: 40, label: "retard moyen de règlement des factures payées (maximum atteint à 60 jours)" },
  { points: 30, label: "part des factures réglées après l'échéance" },
  { points: 30, label: "plus ancien retard en cours (maximum atteint à 90 jours)" },
] as const;

export type RiskLevel = "low" | "moderate" | "high";

const MODERATE_FROM = 30;
const HIGH_FROM = 55;

export function describeRisk(score: number): RiskLevel {
  if (score >= HIGH_FROM) return "high";
  return score >= MODERATE_FROM ? "moderate" : "low";
}

export const RISK_LEVEL_LABELS: Readonly<Record<RiskLevel, string>> = {
  low: "Faible",
  moderate: "Modéré",
  high: "Élevé",
};

export type ScoreDisplay =
  | { kind: "not_applicable" }
  | { kind: "no_history" }
  | { kind: "score"; score: number; level: RiskLevel };

export function scoreForDisplay(identity: ScoringIdentity, score: number | null): ScoreDisplay {
  if (!isScoringEligible(identity)) return { kind: "not_applicable" };
  if (score === null) return { kind: "no_history" };
  return { kind: "score", score, level: describeRisk(score) };
}

/** Comportement de paiement en mots : « règle en moyenne 12 jours après l'échéance ». */
export function describePaymentBehavior(days: number | null): string {
  if (days === null) return "Aucune facture réglée pour l'instant.";
  if (days === 0) return "Règle en moyenne à l'échéance.";
  const count = Math.abs(days);
  const unit = count >= 2 ? "jours" : "jour";
  return days > 0
    ? `Règle en moyenne ${count} ${unit} après l'échéance.`
    : `Règle en moyenne ${count} ${unit} avant l'échéance.`;
}
