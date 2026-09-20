/**
 * Devises. Relia ne convertit jamais : une organisation déclare sa devise de travail, et les
 * synthèses ne portent que sur elle (additionner des devises différentes serait faux). Les factures
 * peuvent être libellées autrement — elles sont alors comptées à part, jamais converties.
 */

/** Codes ISO 4217 connus du moteur Intl : une faute de frappe (« UDS ») est refusée. */
const KNOWN_CURRENCIES: ReadonlySet<string> = new Set(Intl.supportedValuesOf("currency"));

export const isKnownCurrency = (code: string) => KNOWN_CURRENCIES.has(code.toUpperCase());

/**
 * Devises proposées au réglage, pour les marchés que Relia adresse. La validation accepte tout code
 * ISO connu : cette liste ne limite que ce que le formulaire offre.
 */
export const WORKING_CURRENCIES = [
  { code: "EUR", label: "Euro (€)" },
  { code: "RON", label: "Leu roumain (lei)" },
  { code: "CZK", label: "Couronne tchèque (Kč)" },
  { code: "PLN", label: "Zloty polonais (zł)" },
  { code: "HUF", label: "Forint hongrois (Ft)" },
  { code: "BGN", label: "Lev bulgare (лв)" },
  { code: "RSD", label: "Dinar serbe (дин)" },
  { code: "CHF", label: "Franc suisse (CHF)" },
  { code: "GBP", label: "Livre sterling (£)" },
] as const;

export const DEFAULT_CURRENCY = "EUR";
