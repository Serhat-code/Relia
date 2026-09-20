import type { LegalSection } from "./dpa";

/**
 * Conditions générales d'utilisation et d'abonnement, acceptées à l'inscription avec le DPA.
 * À faire valider par un juriste avant l'ouverture. Toute modification impose une nouvelle version.
 */
export const TERMS_VERSION = "2026-09";

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    title: "1. Objet",
    paragraphs: [
      "Les présentes conditions régissent l'accès au service Relia et son utilisation par les professionnels (le « Client ») qui s'y inscrivent. Relia est un logiciel en ligne de suivi des règlements et de relance des factures émises par le Client.",
    ],
  },
  {
    title: "2. Nature du service : un outil, jamais un intermédiaire",
    paragraphs: [
      "Relia fournit un outil. Les relances sont envoyées depuis la boîte e-mail du Client, en son nom, avec son adresse, sa signature et ses coordonnées. Relia n'agit jamais pour le compte du Client auprès de ses propres clients et n'intervient pas dans la relation commerciale.",
      "Relia n'encaisse, ne détient ni ne reverse aucune somme due au Client. Les règlements sont effectués directement entre les clients du Client et le Client.",
      "Le Client décide du contenu des relances, de leur calendrier et de leur envoi. Il garantit l'exactitude et l'exigibilité des factures qu'il fait relancer.",
    ],
  },
  {
    title: "3. Inscription et compte",
    paragraphs: [
      "Le service est réservé aux professionnels. L'inscription suppose l'acceptation des présentes conditions et de l'accord de sous-traitance des données (DPA). Le Client veille à la confidentialité de ses identifiants et reste responsable des actions réalisées depuis son compte.",
    ],
  },
  {
    title: "4. Essai gratuit et abonnement",
    paragraphs: [
      "Toute nouvelle organisation bénéficie d'un essai gratuit de quatorze jours, sans moyen de paiement. À son terme, la préparation et l'envoi des relances sont suspendus jusqu'à la souscription d'une offre ; les données restent consultables.",
      "L'abonnement est mensuel, sans engagement, payable d'avance par carte bancaire via le prestataire de paiement Stripe. Les prix sont indiqués hors taxes sur la page Tarifs. Le Client peut changer d'offre ou résilier à tout moment depuis son espace ; la résiliation prend effet à la fin de la période en cours, sans remboursement de la période entamée.",
      "En cas d'échec de paiement, le prestataire renouvelle ses tentatives ; à défaut de régularisation, l'envoi des relances est suspendu.",
    ],
  },
  {
    title: "5. Utilisation conforme",
    paragraphs: [
      "Le Client s'engage à utiliser Relia pour relancer ses propres factures, dans le respect de la réglementation, notamment celle sur la protection des données et sur les délais de paiement. Il s'interdit toute utilisation pour le compte de tiers.",
      "Les modèles fournis n'incluent aucune menace et distinguent les relations entre professionnels de celles avec les particuliers. Le Client s'engage à ne pas modifier les relances pour y introduire des menaces ou des mentions inapplicables à son client ; Relia peut refuser un texte qui enfreint ces règles.",
    ],
  },
  {
    title: "6. Rédaction assistée par intelligence artificielle",
    paragraphs: [
      "Relia peut proposer des textes rédigés avec l'aide d'un modèle d'intelligence artificielle hébergé dans l'Union européenne, signalés comme tels. Toute relance rédigée par IA est validée par un humain avant le premier envoi à un client donné. Les propositions de l'IA, comme l'analyse des réponses reçues, restent sous le contrôle du Client, qui peut les corriger.",
    ],
  },
  {
    title: "7. Données personnelles",
    paragraphs: [
      "Pour les données des clients du Client, Relia agit en qualité de sous-traitant, dans les conditions de l'accord de sous-traitance des données accepté à l'inscription. Pour les données de compte et de facturation du Client, Relia est responsable de traitement, dans les conditions de sa politique de confidentialité.",
    ],
  },
  {
    title: "8. Disponibilité et assistance",
    paragraphs: [
      "Relia met en œuvre les moyens raisonnables pour assurer la disponibilité et la sécurité du service, sans garantie d'absence d'interruption, notamment pour maintenance. L'envoi et la lecture des e-mails dépendent aussi de la messagerie du Client et de ses prestataires.",
    ],
  },
  {
    title: "9. Responsabilité",
    paragraphs: [
      "Relia est tenue d'une obligation de moyens. Sa responsabilité ne peut être engagée qu'en cas de faute prouvée et est limitée, tous dommages confondus, aux sommes versées par le Client au titre des douze derniers mois. Relia ne répond pas des décisions du Client, du contenu des relances qu'il valide, ni du règlement ou du non-règlement de ses factures.",
    ],
  },
  {
    title: "10. Fin du contrat",
    paragraphs: [
      "À la fin du contrat, le Client peut exporter ses données. Elles sont ensuite supprimées, conformément à l'accord de sous-traitance, sauf obligation légale de conservation.",
    ],
  },
  {
    title: "11. Droit applicable",
    paragraphs: [
      "Les présentes conditions sont soumises au droit français. À défaut d'accord amiable, tout litige relève des tribunaux compétents du ressort du siège de l'éditeur.",
    ],
  },
];
