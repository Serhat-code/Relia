import {
  CLOSED_DASH_DEGREES,
  OPEN_DASH_DEGREES,
  convergenceEasing,
  convergenceTarget,
  dashStyle,
  rotationFromTransform,
  spinSpeed,
  type DashStyle,
  type RingArc,
} from "@/lib/brand/ring";
import { EASE_STANDARD_CSS } from "@/lib/design/motion";

/**
 * Séquences du ReliaLoader, jouées avec l'API Web Animations. Le loader est la seule
 * exception au plafond de 400 ms (CLAUDE.md §6). Chaque phase chevauche la précédente
 * pour que la séquence reste fluide ; tout est annulable à tout moment.
 */
export const SUCCESS_TIMELINE = {
  converge: { durationMs: 600 },
  close: { delayMs: 300, durationMs: 360 },
  pop: { delayMs: 560, durationMs: 420, peakScale: 1.08 },
  wave: { delayMs: 600, durationMs: 720, finalScale: 1.75, initialOpacity: 0.6 },
  reopen: { delayMs: 0, durationMs: 280 },
  reducedClose: { delayMs: 0, durationMs: 240 },
} as const;

export type LoaderArcElement = { arc: RingArc; element: SVGGElement };

export type LoaderElements = {
  ring: SVGSVGElement;
  wave: HTMLElement;
  arcs: readonly LoaderArcElement[];
};

/** État d'un arc relevé juste avant de couper sa rotation CSS. */
export type ArcSnapshot = LoaderArcElement & { angle: number; dasharray: string; dashoffset: string };

type DashTiming = { delayMs: number; durationMs: number };

/** Tiret en pixels, pour le style en ligne comme pour les images clés. */
export function cssDash(dash: DashStyle): { strokeDasharray: string; strokeDashoffset: string } {
  return {
    strokeDasharray: dash.strokeDasharray
      .split(" ")
      .map((length) => `${length}px`)
      .join(" "),
    strokeDashoffset: `${dash.strokeDashoffset}px`,
  };
}

export function snapshotArcs(arcs: readonly LoaderArcElement[]): ArcSnapshot[] {
  return arcs.map(({ arc, element }) => {
    const style = getComputedStyle(element);
    return {
      arc,
      element,
      angle: rotationFromTransform(style.transform),
      dasharray: style.strokeDasharray,
      dashoffset: style.strokeDashoffset,
    };
  });
}

const supportsWebAnimations = (element: Element) => typeof element.animate === "function";

/** Pose l'état final en style en ligne : il s'applique aussi sans Web Animations. */
function applyDash(element: SVGGElement, dash: DashStyle): void {
  const { strokeDasharray, strokeDashoffset } = cssDash(dash);
  element.style.strokeDasharray = strokeDasharray;
  element.style.strokeDashoffset = strokeDashoffset;
}

function animateDash(snapshot: ArcSnapshot, to: DashStyle, timing: DashTiming): Animation {
  return snapshot.element.animate(
    [{ strokeDasharray: snapshot.dasharray, strokeDashoffset: snapshot.dashoffset }, cssDash(to)],
    { delay: timing.delayMs, duration: timing.durationMs, easing: EASE_STANDARD_CSS, fill: "backwards" },
  );
}

/** Chaque arc poursuit sa rotation jusqu'à sa place, en partant de sa vitesse du moment. */
function convergeArc({ arc, element, angle }: ArcSnapshot): Animation {
  const target = convergenceTarget(angle, arc.homeRotation, arc.spinDirection);
  const { durationMs } = SUCCESS_TIMELINE.converge;
  return element.animate([{ transform: `rotate(${angle}deg)` }, { transform: `rotate(${target}deg)` }], {
    duration: durationMs,
    easing: convergenceEasing(spinSpeed(arc), target - angle, durationMs),
  });
}

/** Légère surimpulsion d'échelle : 1 → 1,08 → 1. */
function popRing(ring: SVGSVGElement): Animation {
  const { delayMs, durationMs, peakScale } = SUCCESS_TIMELINE.pop;
  return ring.animate(
    [
      { transform: "scale(1)", easing: EASE_STANDARD_CSS },
      { transform: `scale(${peakScale})`, offset: 0.4, easing: "ease-in-out" },
      { transform: "scale(1)" },
    ],
    { delay: delayMs, duration: durationMs },
  );
}

/** Onde lumineuse diffusée une fois vers l'extérieur. */
function emitWave(wave: HTMLElement): Animation {
  const { delayMs, durationMs, finalScale, initialOpacity } = SUCCESS_TIMELINE.wave;
  return wave.animate(
    [
      { opacity: initialOpacity, transform: "scale(1)" },
      { opacity: 0, transform: `scale(${finalScale})` },
    ],
    { delay: delayMs, duration: durationMs, easing: EASE_STANDARD_CSS },
  );
}

export function playSuccess(elements: LoaderElements, snapshots: readonly ArcSnapshot[], isReducedMotion: boolean): Animation[] {
  const closed = dashStyle(CLOSED_DASH_DEGREES);
  snapshots.forEach(({ element }) => applyDash(element, closed));
  if (!supportsWebAnimations(elements.ring)) return [];

  if (isReducedMotion) {
    return snapshots.map((snapshot) => animateDash(snapshot, closed, SUCCESS_TIMELINE.reducedClose));
  }
  return [
    ...snapshots.map(convergeArc),
    ...snapshots.map((snapshot) => animateDash(snapshot, closed, SUCCESS_TIMELINE.close)),
    popRing(elements.ring),
    emitWave(elements.wave),
  ];
}

/** Retour au chargement : les espaces se rouvrent, la rotation CSS reprend depuis le repos. */
export function playReopen(elements: LoaderElements, snapshots: readonly ArcSnapshot[], isReducedMotion: boolean): Animation[] {
  const open = dashStyle(OPEN_DASH_DEGREES);
  snapshots.forEach(({ element }) => applyDash(element, open));
  if (!supportsWebAnimations(elements.ring)) return [];

  const timing = isReducedMotion ? SUCCESS_TIMELINE.reducedClose : SUCCESS_TIMELINE.reopen;
  return snapshots.map((snapshot) => animateDash(snapshot, open, timing));
}
