/**
 * Accord de sous-traitance (article 28 du RGPD) présenté à l'inscription (§2.2).
 * Toute modification du texte impose une nouvelle version : l'acceptation enregistrée en base
 * (organizations.dpa_version) désigne la version exacte acceptée.
 */
export const DPA_VERSION = "2026-09";

export type LegalSection = { title: string; paragraphs: readonly string[] };

export const DPA_SECTIONS: readonly LegalSection[] = [
  {
    title: "1. Objet et rôles",
    paragraphs: [
      "Le présent accord encadre les traitements de données personnelles réalisés par Relia pour le compte du Client, conformément à l'article 28 du règlement (UE) 2016/679 (RGPD).",
      "Le Client est responsable de traitement des données de ses débiteurs et de leurs interlocuteurs. Relia agit en qualité de sous-traitant et ne traite ces données que sur instruction documentée du Client, pour les besoins du service.",
      "Relia est un outil de relance : les relances partent de la boîte e-mail du Client, en son nom. Relia n'encaisse aucun paiement pour le compte du Client.",
    ],
  },
  {
    title: "2. Description du traitement",
    paragraphs: [
      "Finalité : suivi des règlements et relance amiable des factures émises par le Client.",
      "Nature des opérations : hébergement, organisation et consultation des factures et des débiteurs, planification des relances, rédaction assistée des messages, envoi depuis la boîte du Client, lecture des réponses liées aux factures, journalisation.",
      "Catégories de données : identité et coordonnées des débiteurs et de leurs interlocuteurs, données de facturation (numéros, montants, échéances, règlements), échanges e-mail relatifs aux factures.",
      "Personnes concernées : clients du Client (professionnels et particuliers) et leurs interlocuteurs.",
      "Durée : pendant le contrat, puis selon la durée de conservation paramétrée par le Client (par défaut trois ans après la clôture d'une facture), avec purge automatique.",
    ],
  },
  {
    title: "3. Obligations de Relia",
    paragraphs: [
      "Relia traite les données uniquement pour la finalité décrite et sur instruction du Client, garantit la confidentialité des personnes autorisées à les traiter et met en œuvre les mesures de sécurité décrites à l'article 7.",
      "Relia ne calcule aucun score de solvabilité ou de risque sur des personnes physiques. Toute relance rédigée avec l'aide de l'intelligence artificielle est validée par un humain avant le premier envoi à un débiteur donné.",
      "Relia informe le Client si une instruction lui paraît contraire à la réglementation.",
    ],
  },
  {
    title: "4. Sous-traitants ultérieurs",
    paragraphs: [
      "Le Client autorise Relia à recourir aux sous-traitants ultérieurs listés publiquement sur la page « Sous-traitants ». Relia les soumet à des obligations équivalentes à celles du présent accord.",
      "Relia informe le Client de tout ajout ou remplacement au moins trente jours à l'avance ; le Client peut s'y opposer pour un motif légitime et, à défaut d'accord, résilier le service.",
    ],
  },
  {
    title: "5. Localisation des données",
    paragraphs: [
      "Les données sont hébergées et traitées dans l'Union européenne. Lorsqu'un sous-traitant ultérieur relève d'un pays tiers, Relia s'assure de garanties appropriées (clauses contractuelles types de la Commission européenne ou décision d'adéquation).",
    ],
  },
  {
    title: "6. Droits des personnes concernées",
    paragraphs: [
      "Relia aide le Client à répondre aux demandes d'exercice de droits : le service permet d'exporter et de supprimer les données d'un débiteur. Toute demande reçue directement par Relia est transmise au Client sans délai.",
    ],
  },
  {
    title: "7. Sécurité",
    paragraphs: [
      "Chiffrement des communications ; secrets (jetons d'accès aux boîtes e-mail, mots de passe SMTP, identifiants d'intégration) chiffrés au repos ; cloisonnement strict des données de chaque client au niveau de la base ; journal d'audit immuable des actions automatiques ; sauvegardes régulières.",
    ],
  },
  {
    title: "8. Violations de données",
    paragraphs: [
      "Relia notifie au Client toute violation de données personnelles dans les meilleurs délais et au plus tard quarante-huit heures après en avoir pris connaissance, avec les informations utiles à sa propre notification à l'autorité de contrôle.",
    ],
  },
  {
    title: "9. Sort des données en fin de contrat",
    paragraphs: [
      "À la fin du contrat, Relia supprime les données du Client, ou les lui restitue s'il en fait la demande avant la résiliation, sauf obligation légale de conservation.",
    ],
  },
  {
    title: "10. Documentation et audit",
    paragraphs: [
      "Relia met à la disposition du Client la documentation nécessaire pour démontrer le respect de ses obligations et permet la réalisation d'audits raisonnables, avec un préavis de trente jours.",
    ],
  },
  {
    title: "11. Obligations du Client",
    paragraphs: [
      "Le Client garantit la licéité du traitement, l'information des personnes concernées et l'exactitude des créances relancées. Il reste l'expéditeur des relances et décide de leur contenu.",
    ],
  },
];
