import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { PaidPlan, Plan } from "@/lib/billing/plans";

type PlanCardsProps = {
  plans: readonly Plan[];
  /** Offre souscrite, signalée comme telle. */
  currentPlan?: PaidPlan | null;
  /** Bouton ou lien d'action de chaque offre (paiement, inscription…). */
  actions: Partial<Record<PaidPlan, ReactNode>>;
};

/** Les trois offres, côte à côte ; celle du milieu est mise en avant. Prix hors taxes, sans engagement. */
export function PlanCards({ plans, currentPlan = null, actions }: PlanCardsProps) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = plan.id === currentPlan;
        return (
          <li
            key={plan.id}
            className={cn(
              "relative flex flex-col gap-5 rounded-2xl border bg-elevated p-6",
              plan.isHighlighted ? "border-glow shadow-halo" : "border-border",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
              {isCurrent ? (
                <Badge tone="success">Votre offre</Badge>
              ) : (
                plan.isHighlighted && <Badge tone="accent">La plus choisie</Badge>
              )}
            </div>
            <p className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-semibold tabular-nums">{plan.monthlyPrice} €</span>
              <span className="text-sm text-fg-muted">HT / mois</span>
            </p>
            <p className="text-sm text-fg-muted">{plan.tagline}</p>
            <ul className="flex flex-1 flex-col gap-2.5 border-t border-border pt-5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-sm text-fg">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                  {feature}
                </li>
              ))}
            </ul>
            {actions[plan.id]}
          </li>
        );
      })}
    </ul>
  );
}
