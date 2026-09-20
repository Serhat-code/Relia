const OPAQUE_HEX = /^#[0-9a-f]{6}$/i;

function toLinear(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  if (!OPAQUE_HEX.test(hex)) {
    throw new Error(`Couleur opaque attendue au format #RRGGBB, reçu : ${hex}`);
  }
  const channel = (offset: number) => toLinear(Number.parseInt(hex.slice(offset, offset + 2), 16));
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Rapport de contraste WCAG 2.x entre deux couleurs opaques, de 1 à 21. */
export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
