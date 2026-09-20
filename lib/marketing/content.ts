import type { FaqItem } from "@/components/marketing/Faq";

/**
 * Textes de la page d'accueil et des tarifs. Vocabulaire imposé (§2.1) : relance, suivi des règlements,
 * encaissement ; « agences » seulement au pluriel, pour la clientèle visée.
 */

export const HOW_IT_WORKS = [
  {
    title: "Connectez votre boîte e-mail",
    text: "Gmail, Outlook ou votre messagerie habituelle. Les relances partiront de votre adresse, à votre nom.",
  },
  {
    title: "Importez vos factures",
    text: "Un fichier CSV, des factures électroniques Factur-X, ou une saisie rapide. Relia retrouve vos clients.",
  },
  {
    title: "Validez les relances",
    text: "Relia prépare chaque relance au bon moment et au bon ton. Vous relisez, retouchez si besoin, et validez.",
  },
  {
    title: "Laissez Relia suivre les réponses",
    text: "Dès qu'un client répond, les relances s'arrêtent. Une promesse de règlement est notée et suivie jusqu'à son terme.",
  },
] as const;

export const COMMITMENTS = [
  {
    title: "Depuis votre adresse, jamais la nôtre",
    text: "Vos clients reçoivent un e-mail de vous et vous répondent directement. Relia n'envoie rien en son nom.",
  },
  {
    title: "Aucun paiement ne transite par Relia",
    text: "Vos clients vous règlent comme d'habitude, sur votre compte. Relia suit les règlements, il ne les encaisse pas.",
  },
  {
    title: "Le ton juste, sans menace",
    text: "Courtois, puis ferme, puis une mise en demeure factuelle. Jamais d'intimidation : la relation client reste intacte.",
  },
  {
    title: "Professionnels et particuliers",
    text: "Indemnité forfaitaire de 40 € et pénalités de retard seulement entre professionnels. Délais et ton adaptés aux particuliers.",
  },
  {
    title: "Vous gardez la main",
    text: "L'IA, hébergée en Europe, propose ; vous validez. La première relance rédigée par IA pour un client attend toujours votre accord.",
  },
  {
    title: "Vos données restent à Paris",
    text: "Hébergement dans l'Union européenne, accord de sous-traitance, liste publique des sous-traitants, export et effacement à la demande.",
  },
] as const;

export const LANDING_FAQ: readonly FaqItem[] = [
  {
    question: "Relia contacte-t-il mes clients à ma place ?",
    answer:
      "Non. Relia est un outil : les relances partent de votre propre boîte e-mail, à votre nom, et vos clients vous répondent directement. Vous décidez du contenu et du calendrier.",
  },
  {
    question: "Mes clients règlent-ils Relia ?",
    answer: "Jamais. Vos clients vous paient comme d'habitude, sur votre compte bancaire. Aucun paiement ne transite par Relia.",
  },
  {
    question: "Puis-je relire les relances avant leur envoi ?",
    answer:
      "Oui. Chaque relance préparée attend votre validation. Une fois en confiance, vous pouvez activer l'envoi automatique ; la première relance rédigée par IA pour un client reste toujours soumise à votre accord.",
  },
  {
    question: "Et si mon client est un particulier ?",
    answer:
      "Relia utilise des modèles distincts : délais plus longs, ton plus mesuré, et jamais l'indemnité forfaitaire de 40 € ni les pénalités de retard, réservées aux relations entre professionnels.",
  },
  {
    question: "Que se passe-t-il quand un client répond ?",
    answer:
      "Relia lit la réponse dans votre boîte, la rattache à la facture et met ses relances en pause. S'il annonce une date de règlement, la promesse est suivie : sans règlement quelques jours après, les relances reprennent d'elles-mêmes.",
  },
  {
    question: "Quelles messageries sont compatibles ?",
    answer:
      "Gmail et Google Workspace, Outlook et Microsoft 365, et toute messagerie disposant d'un serveur SMTP : OVHcloud, IONOS, Infomaniak, Orange, Free, et bien d'autres.",
  },
  {
    question: "Où sont hébergées mes données ?",
    answer:
      "Dans l'Union européenne, à Paris. Pour les données de vos clients, Relia agit comme sous-traitant au sens du RGPD : un accord de sous-traitance est accepté à l'inscription et vous pouvez exporter ou effacer les données d'un client à tout moment.",
  },
  {
    question: "Relia lit-il les factures électroniques ?",
    answer:
      "Oui. Relia importe les factures Factur-X (PDF avec données structurées), devenues courantes depuis que la réception des factures électroniques est obligatoire, au 1er septembre 2026.",
  },
];

export const PRICING_FAQ: readonly FaqItem[] = [
  {
    question: "Faut-il une carte bancaire pour l'essai ?",
    answer: "Non. L'essai dure 14 jours, avec toutes les fonctions. Vous choisissez une offre seulement si Relia vous convient.",
  },
  {
    question: "Que se passe-t-il à la fin de l'essai ?",
    answer:
      "Sans abonnement, les relances se mettent en pause ; vos factures et votre historique restent consultables. Elles reprennent dès que vous choisissez une offre.",
  },
  {
    question: "Puis-je changer d'offre ou résilier ?",
    answer:
      "À tout moment, depuis votre espace, sans engagement. Une résiliation prend effet à la fin du mois en cours ; vous pouvez exporter vos données avant.",
  },
  {
    question: "Les prix sont-ils hors taxes ?",
    answer: "Oui, les prix sont indiqués hors taxes, par mois. Une facture conforme vous est adressée chaque mois.",
  },
];
