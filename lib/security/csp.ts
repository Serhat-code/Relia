/**
 * Politique de sécurité du contenu (CSP). Les scripts ne s'exécutent qu'avec le nonce de la requête
 * (Next.js l'applique à ses propres scripts, next-themes au sien) ; 'strict-dynamic' laisse ces
 * scripts charger les morceaux de l'application. Aucune ressource tierce : polices auto-hébergées,
 * pas de mesure d'audience. Seuls les formulaires peuvent mener aux pages de paiement de Stripe.
 */

type CspOptions = { nonce: string; isDevelopment: boolean };

/** Destinations de formulaire autorisées : l'application et le paiement de l'abonnement (Stripe). */
const FORM_ACTIONS = ["'self'", "https://checkout.stripe.com", "https://billing.stripe.com"] as const;

export function buildContentSecurityPolicy({ nonce, isDevelopment }: CspOptions): string {
  const directives: Array<[string, readonly string[]]> = [
    ["default-src", ["'self'"]],
    // En développement, le rechargement à chaud de Next.js a besoin d'eval et d'une connexion WebSocket.
    ["script-src", ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDevelopment ? ["'unsafe-eval'"] : [])]],
    // Les attributs style produits par React (largeurs de barres, délais d'animation) sont en ligne.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    // data: et blob: : favicon animé du chargement, aperçu des fichiers importés.
    ["img-src", ["'self'", "data:", "blob:"]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'", ...(isDevelopment ? ["ws:", "wss:"] : [])]],
    ["form-action", FORM_ACTIONS],
    ["frame-ancestors", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["object-src", ["'none'"]],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
  ];
  const policy = directives.map(([name, sources]) => `${name} ${sources.join(" ")}`);
  if (!isDevelopment) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** Nonce de 128 bits, en base64, renouvelé à chaque requête. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
