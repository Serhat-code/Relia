/**
 * Anneau Relia — source unique pour le logo, le loader et le favicon (CLAUDE.md §6).
 *
 * Quatre arcs de 76° séparés par des espaces de 14°, trait de 8 sur une viewBox 48×48,
 * extrémités arrondies. Un arc par étape du cycle, sens horaire depuis midi :
 * facture émise → relance envoyée → promesse obtenue → encaissement.
 *
 * Les 76° s'entendent extrémités arrondies comprises : avec un trait de 8 sur un rayon
 * de 20, chaque extrémité couvre ~11,5°, sans quoi les espaces de 14° disparaîtraient.
 * Angles en degrés.
 */

export const RING_STAGES = ["issued", "reminded", "promised", "paid"] as const;

export type RingStage = (typeof RING_STAGES)[number];

export const RING_STAGE_LABELS: Readonly<Record<RingStage, string>> = {
  issued: "Facture émise",
  reminded: "Relance envoyée",
  promised: "Promesse obtenue",
  paid: "Encaissement",
};

export const RING = {
  viewBox: 48,
  center: 24,
  radius: 20,
  strokeWidth: 8,
  arcDegrees: 76,
  gapDegrees: 14,
} as const;

export const CIRCUMFERENCE = 2 * Math.PI * RING.radius;

const SLOT_DEGREES = RING.arcDegrees + RING.gapDegrees;

const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const round = (value: number) => Math.round(value * 1000) / 1000;

export const normalizeDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;

/** Angle couvert par une extrémité arrondie. */
export const CAP_DEGREES = toDegrees(RING.strokeWidth / 2 / RING.radius);

/** Tracé hors extrémités : anneau ouvert (quatre arcs) ou fermé (cercle plein). */
export const OPEN_DASH_DEGREES = RING.arcDegrees - 2 * CAP_DEGREES;
export const CLOSED_DASH_DEGREES = SLOT_DEGREES;

export type SpinDirection = 1 | -1;

export type RingArc = {
  stage: RingStage;
  index: number;
  /** Rotation SVG au repos : le tracé d'un <circle> commence à 3 h, soit 90° après midi. */
  homeRotation: number;
  spinDurationMs: number;
  spinDirection: SpinDirection;
  /** Portion du dégradé de marque portée par l'arc, de 0 (accent) à 1 (secondaire). */
  gradientFrom: number;
  gradientTo: number;
};

function ringArc(stage: RingStage, index: number, spinDurationMs: number, spinDirection: SpinDirection): RingArc {
  const centerFromNoon = index * SLOT_DEGREES + SLOT_DEGREES / 2;
  return {
    stage,
    index,
    homeRotation: centerFromNoon - 90,
    spinDurationMs,
    spinDirection,
    gradientFrom: index / RING_STAGES.length,
    gradientTo: (index + 1) / RING_STAGES.length,
  };
}

/** Vitesses 1,2 s / 1,6 s / 2 s / 2,4 s, sens alternés. */
export const RING_ARCS: readonly RingArc[] = [
  ringArc("issued", 0, 1200, 1),
  ringArc("reminded", 1, 1600, -1),
  ringArc("promised", 2, 2000, 1),
  ringArc("paid", 3, 2400, -1),
];

/**
 * Dégradé d'un arc, dans le repère local de l'arc (centré à 3 h) : il suit la corde
 * de son quart de cercle, de haut en bas, c'est-à-dire dans le sens horaire.
 */
export const ARC_GRADIENT_VECTOR = {
  x1: round(RING.center + RING.radius * Math.cos(toRadians(-SLOT_DEGREES / 2))),
  y1: round(RING.center + RING.radius * Math.sin(toRadians(-SLOT_DEGREES / 2))),
  x2: round(RING.center + RING.radius * Math.cos(toRadians(SLOT_DEGREES / 2))),
  y2: round(RING.center + RING.radius * Math.sin(toRadians(SLOT_DEGREES / 2))),
} as const;

/** Dégradé mouvant du chargement : une période complète en « reflect » vaut deux cordes. */
export const FLOW_TRAVEL = round(2 * (ARC_GRADIENT_VECTOR.y2 - ARC_GRADIENT_VECTOR.y1));
export const FLOW_DURATION_MS = 1800;

/** Mouvement réduit : opacité pulsée douce, sans rotation. */
export const REDUCED_MOTION_PULSE = { durationMs: 1600, minOpacity: 0.55 } as const;

export type DashStyle = { strokeDasharray: string; strokeDashoffset: number };

/** Tiret centré sur le début du tracé : la rotation du groupe désigne le milieu de l'arc. */
export function dashStyle(dashDegrees: number): DashStyle {
  const length = (dashDegrees / 360) * CIRCUMFERENCE;
  return {
    strokeDasharray: `${round(length)} ${round(CIRCUMFERENCE - length)}`,
    strokeDashoffset: round(length / 2),
  };
}

/** Vitesse angulaire d'un arc, en degrés par seconde (valeur absolue). */
export function spinSpeed(arc: RingArc): number {
  return 360_000 / arc.spinDurationMs;
}

/** Décalage de rotation d'un arc après `elapsedMs`, ramené dans [0, 360). */
export function spinOffsetAt(arc: RingArc, elapsedMs: number): number {
  const progress = (elapsedMs % arc.spinDurationMs) / arc.spinDurationMs;
  return normalizeDegrees(arc.spinDirection * 360 * progress);
}

/** Course minimale de la convergence : en deçà, l'arc freinerait trop brutalement. */
const MIN_CONVERGENCE_TRAVEL = 90;

/** Cible atteinte en poursuivant dans le sens de rotation jusqu'à la position de repos. */
export function convergenceTarget(current: number, home: number, direction: SpinDirection): number {
  const remaining = normalizeDegrees(direction * (home - current));
  const travel = remaining < MIN_CONVERGENCE_TRAVEL ? remaining + 360 : remaining;
  return current + direction * travel;
}

const CONVERGENCE_X1 = 0.3;

/**
 * Courbe d'accostage : démarre à la vitesse de rotation en cours (pas d'à-coup) et se
 * pose à vitesse nulle. La pente initiale d'une cubic-bezier vaut y1 / x1.
 */
export function convergenceEasing(speed: number, travel: number, durationMs: number): string {
  const initialSlope = (Math.abs(speed) * durationMs) / 1000 / Math.abs(travel);
  const y1 = Math.min(initialSlope * CONVERGENCE_X1, 1);
  return `cubic-bezier(${CONVERGENCE_X1}, ${round(y1)}, 0.36, 1)`;
}

/** Angle d'une transformation calculée (`getComputedStyle(el).transform`). */
export function rotationFromTransform(transform: string): number {
  const match = /^matrix(?:3d)?\(([^)]+)\)$/.exec(transform.trim());
  if (!match?.[1]) return 0;
  const [a = 1, b = 0] = match[1].split(",").map(Number);
  return toDegrees(Math.atan2(b, a));
}

/** Accents de marque, identiques dans les deux thèmes (vérifié par test contre globals.css). */
export const BRAND_HEX = { accent: "#2F6BFF", secondary: "#00E5C2" } as const;

/** Couleur du dégradé de marque à la position t (0 → accent, 1 → secondaire), via les jetons CSS. */
export function brandMixCss(t: number): string {
  if (t <= 0) return "var(--accent)";
  if (t >= 1) return "var(--secondary)";
  return `color-mix(in srgb, var(--accent), var(--secondary) ${round(t * 100)}%)`;
}

const hexChannels = (hex: string) => [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));

/** Même interpolation que brandMixCss, en hexadécimal (favicon : pas de variables CSS). */
export function brandMixHex(t: number): string {
  const from = hexChannels(BRAND_HEX.accent);
  const to = hexChannels(BRAND_HEX.secondary);
  const channels = from.map((value, i) => Math.round(value + ((to[i] ?? value) - value) * t));
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
