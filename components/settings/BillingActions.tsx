"use client";

import { CreditCard, ExternalLink } from "lucide-react";
import { useActionState } from "react";
import { openBillingPortalAction, startCheckoutAction } from "@/app/app/parametres/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import type { PaidPlan } from "@/lib/billing/plans";
import { IDLE_STATE } from "@/lib/forms/form-state";

type CheckoutButtonProps = { plan: PaidPlan; isHighlighted: boolean };

/** Paiement sécurisé chez Stripe : Relia ne voit jamais la carte bancaire. */
export function CheckoutButton({ plan, isHighlighted }: CheckoutButtonProps) {
  const [state, formAction, isPending] = useActionState(startCheckoutAction, IDLE_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="plan" value={plan} />
      <Button
        type="submit"
        variant={isHighlighted ? "primary" : "secondary"}
        className="w-full"
        status={isPending ? "loading" : "idle"}
        loadingLabel="Ouverture du paiement…"
      >
        Choisir cette offre
      </Button>
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
    </form>
  );
}

/** Portail Stripe : changer d'offre, mettre à jour la carte, télécharger les factures, résilier. */
export function PortalButton() {
  const [state, formAction, isPending] = useActionState(openBillingPortalAction, IDLE_STATE);

  return (
    <form action={formAction} className="flex flex-col items-start gap-3">
      <Button
        type="submit"
        variant="secondary"
        icon={<CreditCard aria-hidden />}
        status={isPending ? "loading" : "idle"}
        loadingLabel="Ouverture du portail…"
      >
        Gérer mon abonnement
        <ExternalLink aria-hidden className="size-3.5 text-fg-muted" />
      </Button>
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
    </form>
  );
}
