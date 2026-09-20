import type { LegalSection } from "./dpa";

/**
 * Politique de confidentialité : données des utilisateurs de Relia (Relia responsable de traitement).
 * Les données des clients de nos clients relèvent de l'accord de sous-traitance. À faire valider.
 */
export const PRIVACY_VERSION = "2026-09";

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    title: "1. Deux rôles distincts",
    paragraphs: [
      "Pour les comptes de ses clients et leur facturation, Relia est responsable de traitement : c'est l'objet de cette politique.",
      "Pour les données des clients de ses clients (débiteurs, factures, relances, réponses), Relia est sous-traitant : son client en est responsable de traitement, et l'accord de sous-traitance des données (DPA) s'applique. Une personne qui souhaite exercer ses droits sur ces données s'adresse à l'entreprise qui lui a envoyé la relance ; Relia lui transmet toute demande reçue directement.",
    ],
  },
  {
    title: "2. Données traitées",
    paragraphs: [
      "Compte : nom, adresse e-mail, rôle dans l'organisation, mot de passe (conservé sous forme chiffrée par notre prestataire d'authentification).",
      "Organisation : nom, SIREN, réglages, acceptation de l'accord de sous-traitance (date, version, adresse IP).",
      "Abonnement : offre, statut et historique de paiement, traités par Stripe ; Relia ne voit jamais les numéros de carte.",
      "Journal d'activité : actions réalisées dans le service, pour la sécurité et la traçabilité.",
    ],
  },
  {
    title: "3. Finalités et bases légales",
    paragraphs: [
      "Fournir le service et gérer le compte : exécution du contrat.",
      "Facturer l'abonnement et tenir la comptabilité : exécution du contrat et obligation légale.",
      "Sécuriser le service, prévenir les abus, tracer les actions : intérêt légitime.",
      "Relia n'utilise aucun traceur publicitaire ni outil de mesure d'audience.",
    ],
  },
  {
    title: "4. Destinataires",
    paragraphs: [
      "Les données sont accessibles aux seules personnes habilitées de Relia et à ses sous-traitants, listés publiquement sur la page Sous-traitants : hébergement et base de données en France, paiement par Stripe, e-mails de service par Resend. Elles ne sont jamais vendues.",
    ],
  },
  {
    title: "5. Durées de conservation",
    paragraphs: [
      "Données de compte : pendant la relation contractuelle, puis supprimées à la clôture du compte, sous réserve des obligations légales.",
      "Pièces comptables liées à l'abonnement : dix ans, conformément au Code de commerce.",
      "Journal d'activité : selon la durée de conservation choisie par l'organisation.",
    ],
  },
  {
    title: "6. Vos droits",
    paragraphs: [
      "Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité. Écrivez à l'adresse indiquée dans les mentions légales. Vous pouvez aussi saisir la CNIL (cnil.fr).",
    ],
  },
  {
    title: "7. Cookies et stockage local",
    paragraphs: [
      "Relia n'utilise que des éléments strictement nécessaires : les cookies de session qui vous maintiennent connecté, et la mémorisation locale de votre choix de thème (clair ou sombre). Aucun consentement n'est donc requis.",
    ],
  },
  {
    title: "8. Sécurité et localisation",
    paragraphs: [
      "Les données sont hébergées dans l'Union européenne, à Paris. Les communications sont chiffrées ; les secrets (accès aux boîtes e-mail) sont chiffrés au repos ; les données de chaque organisation sont cloisonnées au niveau de la base.",
    ],
  },
];
