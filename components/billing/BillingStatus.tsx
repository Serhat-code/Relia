import Link from "next/link";
import type { ReactNode } from "react";
import { FormMessage } from "@/components/ui/FormMessage";
import { describeBillingSituation, type BillingSituation } from "@/lib/billing/access";
import { PLAN_NAMES } from "@/lib/billing/plans";
import type { CurrentMember } from "@/lib/data/session";
import { formatDate, pluralize } from "@/lib/format";

type Organization = CurrentMember["organization"];

export function billingSituation(organization: Organization, now = new Date()): BillingSituation {
  return describeBillingSituation(organization.billing, now);
}

const STATUS_WORDS: Readonly<Record<string, string>> = {
  canceled: "résilié",
  unpaid: "impayé",
  incomplete: "incomplet",
  incomplete_expired: "expiré",
  paused: "suspendu",
};

/** Situation de l'abonnement, en une phrase. */
export function BillingSituationText({ organization }: { organization: Organization }) {
  const situation = billingSituation(organization);
  const planName = PLAN_NAMES[organization.plan];
  switch (situation.kind) {
    case "trial":
      return (
        <>
          Essai gratuit : <strong className="font-semibold text-fg">{situation.daysLeft}</strong>{" "}
          {pluralize(situation.daysLeft, "jour restant", "jours restants")}, le temps de tout essayer. Sans carte bancaire.
        </>
      );
    case "trial_ended":
      return <>Votre essai gratuit est terminé : les relances sont en pause jusqu&apos;au choix d&apos;une offre.</>;
    case "lapsed":
      return (
        <>
          Abonnement {STATUS_WORDS[situation.status] ?? "interrompu"} : les relances sont en pause jusqu&apos;à la reprise
          de l&apos;abonnement.
        </>
      );
    case "subscribed":
      if (situation.status === "past_due") {
        return <>Offre {planName} : le dernier paiement a échoué. Stripe réessaie ; mettez à jour votre carte pour éviter une interruption.</>;
      }
      if (situation.endsOn) return <>Offre {planName}, résiliée : elle prend fin le {formatDate(situation.endsOn)}.</>;
      return (
        <>
          Offre {planName}
          {situation.renewsOn ? `, renouvelée le ${formatDate(situation.renewsOn)}` : ""}.
        </>
      );
  }
}

/** Jours d'essai à partir desquels l'application prévient, sur toutes les pages. */
const TRIAL_WARNING_DAYS = 3;

/** Bandeau commun à l'application : fin d'essai proche, relances en pause, paiement en échec. */
export function BillingBanner({ organization }: { organization: Organization }) {
  const situation = billingSituation(organization);
  const link = (label: string) => (
    <Link href="/app/parametres#abonnement" className="font-medium text-link hover:underline">
      {label}
    </Link>
  );
  let message: { tone: "info" | "error"; content: ReactNode } | null = null;
  if (situation.kind === "trial" && situation.daysLeft <= TRIAL_WARNING_DAYS) {
    message = { tone: "info", content: <>Il reste {situation.daysLeft} {pluralize(situation.daysLeft, "jour", "jours")} d&apos;essai. {link("Choisir une offre")}</> };
  } else if (situation.kind === "trial_ended" || situation.kind === "lapsed") {
    message = { tone: "error", content: <>Relances en pause : aucune relance ne part sans abonnement actif. {link("Choisir une offre")}</> };
  } else if (situation.kind === "subscribed" && situation.status === "past_due") {
    message = { tone: "error", content: <>Le paiement de votre abonnement a échoué. {link("Mettre à jour la carte")}</> };
  }
  return message ? (
    <div className="mb-6">
      <FormMessage tone={message.tone}>{message.content}</FormMessage>
    </div>
  ) : null;
}
