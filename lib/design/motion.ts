/**
 * Jetons de mouvement partagés par CSS et Framer Motion (CLAUDE.md §6).
 * Durées en secondes, comme l'attend Framer Motion ; leurs jumelles CSS
 * (--transition-duration-*, classes duration-hover…) sont vérifiées par test.
 */
export const EASE_STANDARD = [0.22, 1, 0.36, 1] as const;
export const EASE_STANDARD_CSS = `cubic-bezier(${EASE_STANDARD.join(", ")})`;

export const DURATION = {
  /** Survol et pression. */
  hover: 0.22,
  /** Apparitions et toasts. */
  enter: 0.28,
  /** Transitions de page. */
  page: 0.32,
} as const;

/** Plafond hors loader : aucune animation d'interface ne dépasse 400 ms. */
export const MAX_UI_DURATION = 0.4;

/** Transitions de page : fondu + translation verticale, blocs en cascade. */
export const PAGE_ENTER_OFFSET_PX = 8;
export const STAGGER_DELAY = 0.04;

export const PRESS_SCALE = 0.97;
