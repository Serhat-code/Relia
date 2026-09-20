"use client";

import { useEffect, useId, useState, type CSSProperties, type Ref } from "react";
import { acquireFaviconAnimation } from "@/lib/brand/favicon-animation";
import {
  CLOSED_DASH_DEGREES,
  OPEN_DASH_DEGREES,
  RING,
  RING_ARCS,
  dashStyle,
  type DashStyle,
  type RingArc,
} from "@/lib/brand/ring";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { cssDash } from "./loader-motion";
import styles from "./ReliaLoader.module.css";
import { ARC_CIRCLE_PROPS, ArcGradients, FlowGradient, arcGradientId, type RingTone } from "./RingParts";
import { useLoaderTransitions, type LoaderState } from "./use-loader-transitions";

export type ReliaLoaderSize = "sm" | "md" | "lg";
export type ReliaLoaderState = LoaderState;
export type ReliaLoaderTone = RingTone;

type ReliaLoaderProps = {
  /** sm : boutons (16 px) · md : imports, synchronisations (32 px) · lg : chargement de page (64 px). */
  size?: ReliaLoaderSize;
  state?: ReliaLoaderState;
  /** « brand » (défaut) ou « current » : couleur du texte, pour un spinner sur fond plein (bouton principal). */
  tone?: ReliaLoaderTone;
  /** Texte annoncé aux lecteurs d'écran ; par défaut « Chargement… » puis « Terminé ». */
  label?: string;
  /** Masque le loader aux technologies d'assistance quand le contexte annonce déjà l'attente. */
  isDecorative?: boolean;
  /** Force le mode mouvement réduit, quelle que soit la préférence système. */
  isReducedMotion?: boolean;
  /** Anime aussi le favicon de l'onglet tant que le chargement dure. */
  hasFaviconAnimation?: boolean;
  className?: string;
};

const SIZE_CLASSES: Record<ReliaLoaderSize, string> = { sm: "size-4", md: "size-8", lg: "size-16" };
const DEFAULT_LABELS: Record<ReliaLoaderState, string> = { loading: "Chargement…", success: "Terminé" };

type ArcStyle = CSSProperties & Record<`--${string}`, string>;

function arcStyle(arc: RingArc, dash: DashStyle): ArcStyle {
  return {
    "--home": `${arc.homeRotation}deg`,
    "--spin-duration": `${arc.spinDurationMs}ms`,
    "--spin-direction": arc.spinDirection === 1 ? "normal" : "reverse",
    ...cssDash(dash),
  };
}

function useFaviconAnimation(isActive: boolean, isReducedMotion: boolean): void {
  useEffect(() => {
    if (!isActive) return;
    return acquireFaviconAnimation(isReducedMotion);
  }, [isActive, isReducedMotion]);
}

type LoaderRingProps = { ref: Ref<SVGSVGElement>; tone: ReliaLoaderTone; mountDash: DashStyle };

/** Deux couches par arc : dégradé de marque dessous, dégradé mouvant dessus (fondu au succès). */
function LoaderRing({ ref, tone, mountDash }: LoaderRingProps) {
  const idPrefix = useId();
  const flowId = `${idPrefix}-flow`;

  return (
    <svg ref={ref} viewBox={`0 0 ${RING.viewBox} ${RING.viewBox}`} className={styles.ring} aria-hidden focusable="false">
      <defs>
        <ArcGradients idPrefix={idPrefix} />
        <FlowGradient id={flowId} tone={tone} />
      </defs>
      {RING_ARCS.map((arc) => (
        <g key={arc.stage} data-stage={arc.stage} className={styles.arc} style={arcStyle(arc, mountDash)}>
          <circle
            {...ARC_CIRCLE_PROPS}
            stroke={tone === "current" ? "currentColor" : `url(#${arcGradientId(idPrefix, arc.index)})`}
          />
          <circle {...ARC_CIRCLE_PROPS} className={styles.flow} stroke={`url(#${flowId})`} />
        </g>
      ))}
    </svg>
  );
}

/** Loader Relia : quatre arcs en rotation qui convergent en anneau plein au succès (CLAUDE.md §6). */
export function ReliaLoader({
  size = "md",
  state = "loading",
  tone = "brand",
  label,
  isDecorative = false,
  isReducedMotion = false,
  hasFaviconAnimation = false,
  className,
}: ReliaLoaderProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMotionReduced = isReducedMotion || prefersReducedMotion;
  const [mountState] = useState(state);
  const { rootRef, ringRef, waveRef } = useLoaderTransitions(state, isMotionReduced);
  useFaviconAnimation(hasFaviconAnimation && state === "loading", isMotionReduced);

  const mountDash = dashStyle(mountState === "success" ? CLOSED_DASH_DEGREES : OPEN_DASH_DEGREES);

  return (
    <span
      ref={rootRef}
      data-state={mountState}
      data-tone={tone}
      data-reduced-motion={isReducedMotion ? "" : undefined}
      role={isDecorative ? undefined : "status"}
      aria-hidden={isDecorative || undefined}
      className={[styles.root, SIZE_CLASSES[size], className].filter(Boolean).join(" ")}
    >
      <span ref={waveRef} className={styles.wave} />
      <LoaderRing ref={ringRef} tone={tone} mountDash={mountDash} />
      {!isDecorative && <span className="sr-only">{label ?? DEFAULT_LABELS[state]}</span>}
    </span>
  );
}
