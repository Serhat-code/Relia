import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { ClientType } from "@/lib/debtors/client-type";
import {
  RISK_LEVEL_LABELS,
  RISK_SCORE_FACTORS,
  describePaymentBehavior,
  scoreForDisplay,
  type RiskLevel,
} from "@/lib/debtors/scoring";

const LEVEL_TONES: Readonly<Record<RiskLevel, BadgeTone>> = { low: "success", moderate: "warning", high: "danger" };
const LEVEL_BARS: Readonly<Record<RiskLevel, string>> = { low: "bg-success", moderate: "bg-warning", high: "bg-danger" };

type RiskScoreCardProps = {
  clientType: ClientType;
  siren: string | null;
  isLegalEntity: boolean;
  riskScore: number | null;
  paymentBehaviorDays: number | null;
};

/** Risque de retard (§2.4) : jamais de score hors personne morale, et un calcul expliqué. */
export function RiskScoreCard({ clientType, siren, isLegalEntity, riskScore, paymentBehaviorDays }: RiskScoreCardProps) {
  const display = scoreForDisplay({ clientType, siren, isLegalEntity }, riskScore);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risque de retard</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {display.kind === "score" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <span className="font-display text-2xl font-semibold tabular-nums">
                {display.score}
                <span className="text-sm font-normal text-fg-muted"> / 100</span>
              </span>
              <Badge tone={LEVEL_TONES[display.level]}>{RISK_LEVEL_LABELS[display.level]}</Badge>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-surface"
              role="meter"
              aria-label="Score de risque de retard"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={display.score}
            >
              <div className={cn("h-full rounded-full", LEVEL_BARS[display.level])} style={{ width: `${display.score}%` }} />
            </div>
          </div>
        )}
        {display.kind === "not_applicable" && (
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold">Non applicable</span>
            <p className="text-sm text-fg-muted">
              Relia ne calcule de score que pour une personne morale identifiée par son SIREN. Un particulier ou un
              entrepreneur individuel n&apos;est jamais noté.
            </p>
          </div>
        )}
        {display.kind === "no_history" && (
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold">Pas encore d&apos;historique</span>
            <p className="text-sm text-fg-muted">
              Le score apparaît dès qu&apos;une facture de ce client est réglée ou arrive à échéance.
            </p>
          </div>
        )}

        <p className="border-t border-border pt-4 text-sm text-fg">{describePaymentBehavior(paymentBehaviorDays)}</p>

        {display.kind !== "not_applicable" && (
          <details className="group text-sm">
            <summary className="cursor-pointer font-medium text-link marker:text-fg-muted">Comment ce score est calculé</summary>
            <div className="mt-3 flex flex-col gap-2 text-fg-muted">
              <p>Uniquement à partir de vos factures avec ce client sur les deux dernières années :</p>
              <ul className="flex flex-col gap-1.5">
                {RISK_SCORE_FACTORS.map((factor) => (
                  <li key={factor.label} className="flex gap-2">
                    <span className="w-16 shrink-0 font-medium text-fg tabular-nums">{factor.points} pts</span>
                    <span>{factor.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
