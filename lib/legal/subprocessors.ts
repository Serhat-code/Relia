/** Sous-traitants ultérieurs (§2.2), affichés sur /sous-traitants et référencés par le DPA. */
export type Subprocessor = {
  name: string;
  purpose: string;
  dataProcessed: string;
  location: string;
};

export const SUBPROCESSORS: readonly Subprocessor[] = [
  {
    name: "Supabase",
    purpose: "Base de données, authentification et stockage de fichiers",
    dataProcessed: "Toutes les données du service",
    location: "Union européenne — Paris (eu-west-3)",
  },
  {
    name: "Vercel",
    purpose: "Hébergement de l'application et exécution des traitements planifiés",
    dataProcessed: "Données en transit lors de l'utilisation du service",
    location: "Union européenne — Paris (cdg1)",
  },
  {
    name: "Mistral AI",
    purpose: "Rédaction assistée des relances et analyse des réponses des clients",
    dataProcessed:
      "Contexte de la facture et du débiteur nécessaire à la rédaction ; texte des réponses reçues, sans la relance citée",
    location: "Union européenne — France",
  },
  {
    name: "Resend",
    purpose: "E-mails transactionnels de Relia (compte, facturation) — jamais les relances",
    dataProcessed: "Adresse e-mail et nom des utilisateurs de Relia",
    location: "Union européenne",
  },
  {
    name: "Stripe",
    purpose: "Paiement de l'abonnement Relia — jamais les règlements des débiteurs",
    dataProcessed: "Coordonnées de facturation du client de Relia",
    location: "Union européenne — Irlande",
  },
];
