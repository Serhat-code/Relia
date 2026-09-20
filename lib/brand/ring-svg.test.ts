import { describe, expect, it } from "vitest";
import { BRAND_HEX } from "./ring";
import { renderRingSvg } from "./ring-svg";

describe("renderRingSvg (favicon statique)", () => {
  const svg = renderRingSvg();

  it("produit un SVG autonome en viewBox 48×48", () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"')).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("dessine quatre arcs à extrémités arrondies", () => {
    expect(svg.match(/<circle /g)).toHaveLength(4);
    expect(svg.match(/stroke-linecap="round"/g)).toHaveLength(4);
  });

  it("utilise les couleurs de marque en dur (aucune variable CSS dans un favicon)", () => {
    expect(svg).toContain(BRAND_HEX.accent);
    expect(svg).toContain(BRAND_HEX.secondary);
    expect(svg).not.toContain("var(");
  });
});
