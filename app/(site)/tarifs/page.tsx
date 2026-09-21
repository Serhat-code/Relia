import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlanCards } from "@/components/billing/PlanCards";
import { Faq } from "@/components/marketing/Faq";
import { Reveal } from "@/components/motion/Reveal";
import { buttonClasses } from "@/components/ui/button-styles";
import { JsonLd } from "@/components/marketing/JsonLd";
import { PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { pricingJsonLd } from "@/lib/marketing/structured-data";
import { PRICING_FAQ } from "@/lib/marketing/content";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "Tarifs",
  description: `Trois offres de 29 à 79 € HT par mois, sans engagement, avec ${TRIAL_DAYS} jours d'essai gratuit sans carte bancaire.`,
};

const INCLUDED = [
  "Relances depuis votre boîte : Gmail, Outlook ou SMTP",
  "Scénarios de relance modifiables, professionnels et particuliers",
  "Modèles conformes : jamais de menace, mentions légales adaptées",
  "Rédaction assistée par IA hébergée en Europe, validée par vous",
  "Lecture des réponses, promesses de règlement suivies",
  "Import CSV et Factur-X, tableau de bord, journal d'audit",
  "Export et effacement des données d'un client (RGPD)",
  "Données hébergées à Paris, accord de sous-traitance",
] as const;

export default function PricingPage() {
  return (
    <>
      <JsonLd data={pricingJsonLd(SITE_URL)} />
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pt-16 pb-24 sm:px-8">
      <Reveal className="flex max-w-2xl flex-col gap-4">
        <p className="text-xs font-semibold tracking-[0.18em] text-link uppercase">Tarifs</p>
        <h1 className="font-display text-3xl leading-tight font-semibold text-balance">Choisissez quand vous êtes prêt.</h1>
        <p className="text-lg leading-relaxed text-fg-muted">
          {TRIAL_DAYS} jours d&apos;essai gratuit avec toutes les fonctions, sans carte bancaire. Ensuite, un abonnement
          mensuel sans engagement, à changer ou résilier quand vous voulez.
        </p>
      </Reveal>

      <Reveal index={1}>
        <PlanCards
          plans={PLANS}
          actions={Object.fromEntries(
            PLANS.map((plan) => [
              plan.id,
              <Link
                key={plan.id}
                href="/inscription"
                className={buttonClasses({ variant: plan.isHighlighted ? "primary" : "secondary", className: "w-full" })}
              >
                Commencer l&apos;essai gratuit
              </Link>,
            ]),
          )}
        />
      </Reveal>

      <Reveal index={2} className="grid gap-8 rounded-2xl border border-border bg-elevated p-6 sm:p-8 lg:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-semibold">Inclus dans toutes les offres</h2>
          <p className="text-sm text-fg-muted">Les offres ne diffèrent que par le nombre d&apos;utilisateurs et de factures suivies.</p>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {INCLUDED.map((feature) => (
            <li key={feature} className="flex gap-2.5 text-sm text-fg">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
              {feature}
            </li>
          ))}
        </ul>
      </Reveal>

      <section className="flex flex-col gap-6">
        <Reveal>
          <h2 className="font-display text-xl font-semibold">Questions sur l&apos;abonnement</h2>
        </Reveal>
        <Reveal index={1}>
          <Faq items={PRICING_FAQ} />
        </Reveal>
        </section>
      </div>
    </>
  );
}
