import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** Une seule MediaQueryList pour toute l'application : getSnapshot est appelé à chaque rendu. */
let media: MediaQueryList | null = null;
const reducedMotionQuery = () => (media ??= window.matchMedia(QUERY));

function subscribe(onChange: () => void): () => void {
  const query = reducedMotionQuery();
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const getSnapshot = () => reducedMotionQuery().matches;

/** Côté serveur, on suppose le mouvement autorisé ; le CSS gère déjà la préférence avant hydratation. */
const getServerSnapshot = () => false;

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
