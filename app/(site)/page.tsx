import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import { landingJsonLd } from "@/lib/marketing/structured-data";
import Link from "next/link";
import { ReliaMark } from "@/components/brand/ReliaMark";
import { PlanCards } from "@/components/billing/PlanCards";
import { Faq } from "@/components/marketing/Faq";
import { HeroVisual } from "@/components/marketing/HeroVisual";
import { Reveal } from "@/components/motion/Reveal";
import { buttonClasses } from "@/components/ui/button-styles";
import { PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { RING_STAGE_LABELS, RING_STAGES, type RingStage } from "@/lib/brand/ring";
import { COMMITMENTS, HOW_IT_WORKS, LANDING_FAQ } from "@/lib/marketing/content";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  title: { absolute: "Relia — relance automatique des factures impayées" },
  description:
    "Relia prépare vos relances de factures au ton juste, les envoie depuis votre propre boîte e-mail, lit les réponses de vos clients et suit leurs promesses de règlement. Essai gratuit de 14 jours, sans carte bancaire.",
  openGraph: {
    title: "Relia — faites-vous payer à l'heure, sans relancer à la main",
    description: "Relances depuis votre boîte e-mail, réponses et promesses suivies, données hébergées à Paris.",
    locale: "fr_FR",
    type: "website",
  },
};

const STAGE_TEXTS: Readonly<Record<RingStage, string>> = {
  issued: "La facture est importée ; Relia connaît son échéance et le scénario de relance du client.",
  reminded: "Au bon moment, une relance part de votre boîte : courtoise d'abord, plus ferme ensuite.",
  promised: "Le client répond : Relia note la date promise et suspend les relances jusque-là.",
  paid: "Le règlement arrive sur votre compte : la facture sort du cycle, la promesse est tenue.",
};

const TRUST_POINTS = ["Sans carte bancaire", "Prise en main en 10 minutes", "Données hébergées à Paris"] as const;

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <p className="text-xs font-semibold tracking-[0.18em] text-link uppercase">{eyebrow}</p>
      <h2 className="font-display text-2xl leading-tight font-semibold text-balance">{title}</h2>
      {text && <p className="text-base leading-relaxed text-fg-muted">{text}</p>}
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <JsonLd data={landingJsonLd(SITE_URL)} />
      {/* Accroche */}
      {/* overflow-x-clip : le halo du visuel ne doit pas élargir la page sur téléphone. */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 overflow-x-clip px-4 pt-16 pb-20 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:overflow-visible lg:pt-24 lg:pb-28">
        <Reveal className="flex flex-col gap-7">
          <p className="w-fit rounded-full border border-glow bg-accent-soft px-3 py-1 text-xs font-medium text-fg">
            Pour les TPE, PME, freelances et agences
          </p>
          <h1 className="font-display text-3xl leading-[1.05] font-semibold tracking-tight text-balance">
            Faites-vous payer à l&apos;heure, <span className="text-gradient-brand">sans relancer à la main.</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-fg-muted">
            Relia prépare des relances au ton juste, les envoie depuis votre propre boîte e-mail, lit les réponses de vos
            clients et suit leurs promesses de règlement. Vous gardez la main, et la relation.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/inscription" className={buttonClasses({ size: "lg" })}>
              Essayer {TRIAL_DAYS} jours gratuitement
              <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link href="/tarifs" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Voir les tarifs
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-muted">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-1.5">
                <Check aria-hidden className="size-4 text-success" />
                {point}
              </li>
            ))}
          </ul>
        </Reveal>
        <HeroVisual />
      </section>

      {/* Constat */}
      <section className="border-y border-border bg-elevated/50">
        <Reveal className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-8">
          <p className="font-display text-xl leading-snug font-medium text-balance">
            Les factures partent à 30 jours, sont payées à 60, et personne ne relance.{" "}
            <span className="text-fg-muted">Parce que relancer un client est gênant, et que le temps manque.</span>
          </p>
        </Reveal>
      </section>

      {/* Fonctionnement */}
      <section id="fonctionnement" className="mx-auto flex max-w-6xl scroll-mt-20 flex-col gap-10 px-4 py-20 sm:px-8">
        <Reveal>
          <SectionTitle
            eyebrow="Fonctionnement"
            title="Quatre étapes, dix minutes, et Relia s'occupe du reste."
            text="Pas de rendez-vous commercial, pas d'installation : tout se fait en ligne, depuis votre navigateur."
          />
        </Reveal>
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.title}>
              <Reveal index={index + 1} className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-elevated p-5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft font-display text-sm font-semibold text-link tabular-nums">
                  {index + 1}
                </span>
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-fg-muted">{step.text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* Le cycle de l'anneau */}
      <section className="border-y border-border bg-elevated/50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[auto_1fr]">
          <Reveal className="mx-auto">
            <ReliaMark size={176} isDecorative />
          </Reveal>
          <div className="flex flex-col gap-8">
            <Reveal>
              <SectionTitle
                eyebrow="Un cycle, quatre temps"
                title="De la facture émise à l'encaissement, chaque étape suivie."
                text="Les quatre arcs de l'anneau Relia sont les quatre temps d'une facture. Vous voyez à tout moment où en est chacune."
              />
            </Reveal>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {RING_STAGES.map((stage, index) => (
                <li key={stage}>
                  <Reveal index={index + 1} className="flex gap-4">
                    <ReliaMark size={36} stage={stage} isDecorative className="shrink-0" />
                    <div className="flex flex-col gap-1">
                      <h3 className="text-base font-semibold">{RING_STAGE_LABELS[stage]}</h3>
                      <p className="text-sm leading-relaxed text-fg-muted">{STAGE_TEXTS[stage]}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Engagements */}
      <section id="engagements" className="mx-auto flex max-w-6xl scroll-mt-20 flex-col gap-10 px-4 py-20 sm:px-8">
        <Reveal>
          <SectionTitle
            eyebrow="Nos engagements"
            title="Un outil à votre service, jamais un intermédiaire."
            text="Relia vous fait gagner du temps sans jamais parler à votre place ni toucher à votre argent."
          />
        </Reveal>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMMITMENTS.map((commitment, index) => (
            <li key={commitment.title}>
              <Reveal
                index={Math.min(index + 1, 6)}
                className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-elevated p-5 transition-colors duration-hover hover:border-glow"
              >
                <h3 className="text-base font-semibold">{commitment.title}</h3>
                <p className="text-sm leading-relaxed text-fg-muted">{commitment.text}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      {/* Tarifs */}
      <section className="border-y border-border bg-elevated/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 sm:px-8">
          <Reveal>
            <SectionTitle
              eyebrow="Tarifs"
              title="Un abonnement simple, sans engagement."
              text={`${TRIAL_DAYS} jours d'essai gratuit, toutes les fonctions comprises. Prix hors taxes, par mois.`}
            />
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
                    Commencer l&apos;essai
                  </Link>,
                ]),
              )}
            />
          </Reveal>
        </div>
      </section>

      {/* Questions */}
      <section className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-20 sm:px-8">
        <Reveal>
          <SectionTitle eyebrow="Questions fréquentes" title="Ce que l'on nous demande le plus souvent." />
        </Reveal>
        <Reveal index={1}>
          <Faq items={LANDING_FAQ} />
        </Reveal>
      </section>

      {/* Dernier appel */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">
        <Reveal className="relative overflow-hidden rounded-3xl border border-glow bg-elevated px-6 py-14 text-center shadow-halo sm:px-12">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-glow" />
          <div className="relative flex flex-col items-center gap-5">
            <ReliaMark size={44} stage="paid" isDecorative />
            <h2 className="font-display text-2xl font-semibold text-balance">Vos prochaines relances sont prêtes en dix minutes.</h2>
            <p className="max-w-xl text-base text-fg-muted">
              Connectez votre boîte, importez vos factures, validez. Relia suit le reste, et vous prévient quand un client
              répond.
            </p>
            <Link href="/inscription" className={buttonClasses({ size: "lg" })}>
              Essayer gratuitement
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
