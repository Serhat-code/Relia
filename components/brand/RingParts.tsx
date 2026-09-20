import type { CSSProperties } from "react";
import {
  ARC_GRADIENT_VECTOR,
  FLOW_DURATION_MS,
  FLOW_TRAVEL,
  RING,
  RING_ARCS,
  brandMixCss,
} from "@/lib/brand/ring";

/** Attributs communs aux arcs : cercle complet, le tiret découpe l'arc visible. */
export const ARC_CIRCLE_PROPS = {
  cx: RING.center,
  cy: RING.center,
  r: RING.radius,
  fill: "none",
  strokeWidth: RING.strokeWidth,
  strokeLinecap: "round",
} as const;

export const arcGradientId = (prefix: string, index: number) => `${prefix}-arc-${index}`;

/**
 * Un dégradé par arc, dans son repère local : chaque arc porte un quart du dégradé
 * de marque, si bien que l'anneau va de l'accent au secondaire dans le sens horaire.
 */
export function ArcGradients({ idPrefix }: { idPrefix: string }) {
  return RING_ARCS.map((arc) => (
    <linearGradient
      key={arc.stage}
      id={arcGradientId(idPrefix, arc.index)}
      gradientUnits="userSpaceOnUse"
      {...ARC_GRADIENT_VECTOR}
    >
      <stop offset="0" style={{ stopColor: brandMixCss(arc.gradientFrom) }} />
      <stop offset="1" style={{ stopColor: brandMixCss(arc.gradientTo) }} />
    </linearGradient>
  ));
}

/** « brand » : dégradé de marque · « current » : couleur du texte (spinner sur fond plein). */
export type RingTone = "brand" | "current";

const FLOW_STOPS: Record<RingTone, readonly [CSSProperties, CSSProperties]> = {
  brand: [{ stopColor: "var(--accent)" }, { stopColor: "var(--secondary)" }],
  current: [
    { stopColor: "currentColor", stopOpacity: 1 },
    { stopColor: "currentColor", stopOpacity: 0.4 },
  ],
};

/**
 * Dégradé du chargement : répété en miroir et translaté le long de la corde, pour
 * qu'il se déplace le long des arcs pendant qu'ils tournent.
 * Animation SMIL : elle démarre sans JavaScript, avant l'hydratation.
 */
export function FlowGradient({ id, tone }: { id: string; tone: RingTone }) {
  const [from, to] = FLOW_STOPS[tone];
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" spreadMethod="reflect" {...ARC_GRADIENT_VECTOR}>
      <stop offset="0" style={from} />
      <stop offset="1" style={to} />
      <animateTransform
        attributeName="gradientTransform"
        type="translate"
        from="0 0"
        to={`0 ${FLOW_TRAVEL}`}
        dur={`${FLOW_DURATION_MS}ms`}
        repeatCount="indefinite"
      />
    </linearGradient>
  );
}
