import { ARC_GRADIENT_VECTOR, OPEN_DASH_DEGREES, RING, RING_ARCS, brandMixHex, dashStyle } from "./ring";

/** Anneau Relia en SVG autonome, couleurs en dur : sert de favicon statique (app/icon.ts). */
export function renderRingSvg(): string {
  const { x1, y1, x2, y2 } = ARC_GRADIENT_VECTOR;
  const { strokeDasharray, strokeDashoffset } = dashStyle(OPEN_DASH_DEGREES);
  const { center, radius, strokeWidth, viewBox } = RING;

  const gradients = RING_ARCS.map(
    (arc) =>
      `<linearGradient id="a${arc.index}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
      `<stop offset="0" stop-color="${brandMixHex(arc.gradientFrom)}"/>` +
      `<stop offset="1" stop-color="${brandMixHex(arc.gradientTo)}"/>` +
      `</linearGradient>`,
  ).join("");

  const arcs = RING_ARCS.map(
    (arc) =>
      `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="url(#a${arc.index})" ` +
      `stroke-width="${strokeWidth}" stroke-linecap="round" stroke-dasharray="${strokeDasharray}" ` +
      `stroke-dashoffset="${strokeDashoffset}" transform="rotate(${arc.homeRotation} ${center} ${center})"/>`,
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox} ${viewBox}"><defs>${gradients}</defs>${arcs}</svg>`;
}
