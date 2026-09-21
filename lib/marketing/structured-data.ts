import { PLANS } from "@/lib/billing/plans";
import { PUBLISHER } from "@/lib/legal/publisher";
import { LANDING_FAQ } from "./content";

/**
 * Données structurées schema.org de la page d'accueil et de la page tarifs. Elles décrivent au
 * moteur de recherche ce que Relia vend et à quel prix, et rendent les questions fréquentes
 * éligibles à un affichage enrichi — la requête « relance facture impayée » est le canal
 * d'acquisition principal.
 *
 * Tout est dérivé des sources déjà en place (offres, questions, éditeur) : rien n'est retranscrit,
 * donc rien ne peut mentir. Un prix qui change sur la page tarifs change ici.
 */

export type JsonLdObject = Record<string, unknown>;

const RELIA_DESCRIPTION =
  "Relia relance automatiquement vos factures impayées depuis votre propre boîte e-mail, suit les réponses de vos clients et les promesses de règlement.";

const absolute = (siteUrl: string, path: string) => `${siteUrl.replace(/\/$/, "")}${path}`;

/** L'éditeur : seulement ce qui est réellement renseigné (les mentions légales restent à compléter). */
function publisherFields(): JsonLdObject {
  const fields: JsonLdObject = {};
  if (PUBLISHER.companyName) fields.legalName = PUBLISHER.companyName;
  if (PUBLISHER.vatNumber) fields.vatID = PUBLISHER.vatNumber;
  if (PUBLISHER.contactEmail) fields.email = PUBLISHER.contactEmail;
  return fields;
}

export function organizationJsonLd(siteUrl: string): JsonLdObject {
  return {
    "@type": "Organization",
    "@id": absolute(siteUrl, "/#organisation"),
    name: "Relia",
    url: absolute(siteUrl, "/"),
    description: RELIA_DESCRIPTION,
    ...publisherFields(),
  };
}

/** L'offre la moins chère sert de prix d'appel, les trois sont listées. */
export function softwareJsonLd(siteUrl: string): JsonLdObject {
  return {
    "@type": "SoftwareApplication",
    "@id": absolute(siteUrl, "/#logiciel"),
    name: "Relia",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: absolute(siteUrl, "/"),
    description: RELIA_DESCRIPTION,
    inLanguage: "fr-FR",
    publisher: { "@id": absolute(siteUrl, "/#organisation") },
    offers: PLANS.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      price: plan.monthlyPrice,
      priceCurrency: "EUR",
      // Prix hors taxes, par mois, sans engagement.
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: plan.monthlyPrice,
        priceCurrency: "EUR",
        valueAddedTaxIncluded: false,
        unitCode: "MON",
      },
      url: absolute(siteUrl, "/tarifs"),
    })),
  };
}

export function faqJsonLd(siteUrl: string): JsonLdObject {
  return {
    "@type": "FAQPage",
    "@id": absolute(siteUrl, "/#questions"),
    mainEntity: LANDING_FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** Un seul graphe par page : les entités s'y référencent par `@id`. */
export const landingJsonLd = (siteUrl: string): JsonLdObject => ({
  "@context": "https://schema.org",
  "@graph": [organizationJsonLd(siteUrl), softwareJsonLd(siteUrl), faqJsonLd(siteUrl)],
});

export const pricingJsonLd = (siteUrl: string): JsonLdObject => ({
  "@context": "https://schema.org",
  "@graph": [organizationJsonLd(siteUrl), softwareJsonLd(siteUrl)],
});
