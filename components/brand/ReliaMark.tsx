import { useId } from "react";
import { OPEN_DASH_DEGREES, RING, RING_ARCS, RING_STAGE_LABELS, dashStyle, type RingStage } from "@/lib/brand/ring";
import { ARC_CIRCLE_PROPS, ArcGradients, arcGradientId } from "./RingParts";

/** Opacité des arcs des étapes non mises en avant. */
const DIMMED_ARC_OPACITY = 0.22;

type ReliaMarkProps = {
  /** Taille en pixels. */
  size?: number;
  /** Met en avant une étape du cycle : son arc est le seul plein (ex. « paid » → encaissement). */
  stage?: RingStage;
  isDecorative?: boolean;
  className?: string;
};

/** Logo Relia : anneau segmenté en quatre arcs, un par étape du cycle. */
export function ReliaMark({ size = 32, stage, isDecorative = false, className }: ReliaMarkProps) {
  const idPrefix = useId();
  const dash = dashStyle(OPEN_DASH_DEGREES);
  const label = stage ? `Relia — ${RING_STAGE_LABELS[stage]}` : "Relia";

  return (
    <svg
      viewBox={`0 0 ${RING.viewBox} ${RING.viewBox}`}
      width={size}
      height={size}
      overflow="visible"
      className={className}
      role={isDecorative ? undefined : "img"}
      aria-label={isDecorative ? undefined : label}
      aria-hidden={isDecorative || undefined}
    >
      <defs>
        <ArcGradients idPrefix={idPrefix} />
      </defs>
      {RING_ARCS.map((arc) => (
        <circle
          key={arc.stage}
          data-stage={arc.stage}
          {...ARC_CIRCLE_PROPS}
          stroke={`url(#${arcGradientId(idPrefix, arc.index)})`}
          strokeDasharray={dash.strokeDasharray}
          strokeDashoffset={dash.strokeDashoffset}
          transform={`rotate(${arc.homeRotation} ${RING.center} ${RING.center})`}
          opacity={stage && stage !== arc.stage ? DIMMED_ARC_OPACITY : 1}
        />
      ))}
    </svg>
  );
}
