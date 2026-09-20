/**
 * Éditeur du site (mentions légales, loi n° 2004-575 du 21 juin 2004, art. 6). À compléter avant
 * l'ouverture du service : tant qu'un champ vaut null, la page l'affiche « à compléter ».
 */
export type Publisher = {
  companyName: string | null;
  legalForm: string | null;
  shareCapital: string | null;
  siren: string | null;
  rcsCity: string | null;
  vatNumber: string | null;
  address: string | null;
  publicationDirector: string | null;
  contactEmail: string | null;
  privacyEmail: string | null;
};

export const PUBLISHER: Publisher = {
  companyName: null,
  legalForm: null,
  shareCapital: null,
  siren: null,
  rcsCity: null,
  vatNumber: null,
  address: null,
  publicationDirector: null,
  contactEmail: null,
  privacyEmail: null,
};

export const isPublisherComplete = (publisher: Publisher = PUBLISHER) => Object.values(publisher).every((value) => value !== null);

/** Hébergement du site et des données (région Paris). */
export const HOSTING = [
  {
    role: "Hébergement du site",
    name: "Vercel Inc.",
    address: "440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis",
    detail: "Exécution en région Paris (cdg1), Union européenne.",
  },
  {
    role: "Hébergement des données",
    name: "Supabase Inc.",
    address: null,
    detail: "Base de données en région Paris (eu-west-3), Union européenne.",
  },
] as const;
