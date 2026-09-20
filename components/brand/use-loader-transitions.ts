import { useEffect, useLayoutEffect, useRef } from "react";
import { RING_ARCS } from "@/lib/brand/ring";
import { playReopen, playSuccess, snapshotArcs, type LoaderElements } from "./loader-motion";

export type LoaderState = "loading" | "success";

/** Les arcs sont retrouvés par leur data-stage : une seule ref pour l'anneau suffit. */
function collectElements(ring: SVGSVGElement | null, wave: HTMLElement | null): LoaderElements | null {
  if (!ring || !wave) return null;
  const arcs = RING_ARCS.flatMap((arc) => {
    const element = ring.querySelector<SVGGElement>(`g[data-stage="${arc.stage}"]`);
    return element ? [{ arc, element }] : [];
  });
  return arcs.length === RING_ARCS.length ? { ring, wave, arcs } : null;
}

/**
 * Pilote data-state hors du rendu React : pour converger sans à-coup, il faut relever
 * l'angle des arcs *avant* que le changement d'état ne coupe leur rotation CSS.
 * Le rendu JSX ne pose data-state qu'au montage.
 */
export function useLoaderTransitions(state: LoaderState, isReducedMotion: boolean) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<SVGSVGElement>(null);
  const waveRef = useRef<HTMLSpanElement>(null);
  const running = useRef<Animation[]>([]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const elements = collectElements(ringRef.current, waveRef.current);
    if (!root || !elements || root.dataset.state === state) return;

    const snapshots = snapshotArcs(elements.arcs);
    running.current.forEach((animation) => animation.cancel());
    root.dataset.state = state;
    running.current =
      state === "success"
        ? playSuccess(elements, snapshots, isReducedMotion)
        : playReopen(elements, snapshots, isReducedMotion);
  }, [state, isReducedMotion]);

  useEffect(() => {
    const animations = running;
    return () => animations.current.forEach((animation) => animation.cancel());
  }, []);

  return { rootRef, ringRef, waveRef };
}
