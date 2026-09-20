import { vi } from "vitest";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function mediaQueryList(media: string) {
  return {
    matches: false,
    media,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
}

/**
 * Comme dans un navigateur, la MediaQueryList est un objet vivant : l'application peut
 * la garder en cache, sa propriété `matches` suit la préférence simulée.
 */
const reducedMotionMedia = mediaQueryList(REDUCED_MOTION_QUERY);

/** jsdom n'implémente pas matchMedia : simule la préférence « mouvement réduit ». */
export function stubReducedMotion(matches: boolean): void {
  reducedMotionMedia.matches = matches;
  vi.stubGlobal("matchMedia", (query: string) =>
    query === REDUCED_MOTION_QUERY ? reducedMotionMedia : mediaQueryList(query),
  );
}
