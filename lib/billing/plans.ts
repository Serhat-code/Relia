/**
 * Offres de Relia (§1 : 29 à 79 €/mois, sans rendez-vous commercial ; §5.9 : essai de 14 jours sans
 * carte). Stripe n'encaisse que cet abonnement, jamais les règlements des clients (§2.1).
 */

// `limits.ts` ne reprend d'ici qu'un type, effacé à la compilation : pas de cycle à l'exécution.
import { planFeatures } from "./limits";

export const TRIAL_DAYS = 14;

export type PaidPlan = "starter" | "pro" | "business";

export type Plan = {
  id: PaidPlan;
  name: string;
  /** Prix mensuel hors taxes, en euros. */
  monthlyPrice: number;
  tagline: string;
  features: readonly string[];
  isHighlighted?: boolean;
};

const ESSENTIALS = [
  "Relances depuis votre propre boîte e-mail",
  "Scénarios professionnels et particuliers",
  "Rédaction assistée par IA hébergée en Europe",
  "Lecture des réponses et des promesses de règlement",
] as const;

export const PLANS: readonly Plan[] = [
  {
    id: "starter",
    name: "Essentiel",
    monthlyPrice: 29,
    tagline: "Pour un indépendant qui veut arrêter de relancer à la main.",
    features: [...ESSENTIALS, ...planFeatures("starter")],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 49,
    tagline: "Pour une TPE ou un studio qui facture chaque semaine.",
    features: [...ESSENTIALS, ...planFeatures("pro")],
    isHighlighted: true,
  },
  {
    id: "business",
    name: "Business",
    monthlyPrice: 79,
    tagline: "Pour une PME avec un service comptable.",
    features: [...ESSENTIALS, ...planFeatures("business"), "Assistance prioritaire"],
  },
];

export const PLAN_NAMES: Readonly<Record<PaidPlan | "trial", string>> = {
  trial: "Essai gratuit",
  starter: "Essentiel",
  pro: "Pro",
  business: "Business",
};

export const isPaidPlan = (value: string): value is PaidPlan => PLANS.some((plan) => plan.id === value);
