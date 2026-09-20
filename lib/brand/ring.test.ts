import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ARC_GRADIENT_VECTOR,
  BRAND_HEX,
  CAP_DEGREES,
  CLOSED_DASH_DEGREES,
  CIRCUMFERENCE,
  OPEN_DASH_DEGREES,
  RING,
  RING_ARCS,
  RING_STAGES,
  brandMixCss,
  brandMixHex,
  convergenceEasing,
  convergenceTarget,
  dashStyle,
  rotationFromTransform,
  spinOffsetAt,
  spinSpeed,
} from "./ring";

describe("géométrie de l'anneau (§6)", () => {
  it("l'anneau tient exactement dans la viewBox 48×48 avec un trait de 8", () => {
    expect(RING.viewBox).toBe(48);
    expect(RING.strokeWidth).toBe(8);
    expect(RING.radius + RING.strokeWidth / 2).toBe(RING.viewBox / 2);
  });

  it("chaque arc visible couvre 76°, extrémités arrondies comprises", () => {
    expect(OPEN_DASH_DEGREES + 2 * CAP_DEGREES).toBeCloseTo(76, 10);
  });

  it("les arcs sont séparés par des espaces visibles de 14°", () => {
    expect(360 / RING_ARCS.length - (OPEN_DASH_DEGREES + 2 * CAP_DEGREES)).toBeCloseTo(14, 10);
  });

  it("l'anneau fermé ne laisse aucun espace", () => {
    expect(CLOSED_DASH_DEGREES * RING_ARCS.length).toBe(360);
  });

  it("un arc par étape du cycle, dans l'ordre, sens horaire depuis midi", () => {
    expect(RING_ARCS.map((arc) => arc.stage)).toEqual([...RING_STAGES]);
    expect(RING_STAGES).toEqual(["issued", "reminded", "promised", "paid"]);
    expect(RING_ARCS.map((arc) => arc.homeRotation)).toEqual([-45, 45, 135, 225]);
  });

  it("le dégradé va de l'accent primaire à l'accent secondaire, dans le sens horaire", () => {
    expect(RING_ARCS.map((arc) => [arc.gradientFrom, arc.gradientTo])).toEqual([
      [0, 0.25],
      [0.25, 0.5],
      [0.5, 0.75],
      [0.75, 1],
    ]);
  });

  it("le vecteur de dégradé suit la corde de l'arc, de haut en bas (sens horaire)", () => {
    expect(ARC_GRADIENT_VECTOR.x1).toBeCloseTo(ARC_GRADIENT_VECTOR.x2, 10);
    expect(ARC_GRADIENT_VECTOR.y1).toBeLessThan(ARC_GRADIENT_VECTOR.y2);
  });
});

describe("dashStyle", () => {
  it("centre le tiret sur le début du tracé", () => {
    const style = dashStyle(90);
    const [dash = 0, gap = 0] = style.strokeDasharray.split(" ").map(Number);

    expect(dash + gap).toBeCloseTo(CIRCUMFERENCE, 2);
    expect(style.strokeDashoffset).toBeCloseTo(dash / 2, 2);
  });
});

describe("rotation du loader", () => {
  it("vitesses 1,2 s / 1,6 s / 2 s / 2,4 s en sens alternés", () => {
    expect(RING_ARCS.map((arc) => arc.spinDurationMs)).toEqual([1200, 1600, 2000, 2400]);
    expect(RING_ARCS.map((arc) => arc.spinDirection)).toEqual([1, -1, 1, -1]);
  });

  it("spinSpeed donne la vitesse angulaire en degrés par seconde", () => {
    expect(RING_ARCS.map(spinSpeed)).toEqual([300, 225, 180, 150]);
  });

  it("spinOffsetAt suit le sens de rotation de chaque arc", () => {
    const [first, second] = RING_ARCS;
    if (!first || !second) throw new Error("Arcs manquants");

    expect(spinOffsetAt(first, 600)).toBe(180);
    expect(spinOffsetAt(second, 400)).toBe(270);
    expect(spinOffsetAt(first, 1200)).toBe(0);
  });
});

describe("convergence vers l'anneau fermé", () => {
  it("continue dans le sens de rotation jusqu'à la position de repos", () => {
    expect(convergenceTarget(-80, 45, 1)).toBe(45);
    expect(convergenceTarget(200, 45, -1)).toBe(45);
  });

  it("parcourt au moins un quart de tour pour ne pas freiner brutalement", () => {
    expect(convergenceTarget(30, 45, 1)).toBe(405);
    expect(convergenceTarget(45, 45, -1)).toBe(-315);
  });

  it("la courbe démarre à la vitesse de rotation en cours et se pose sans vitesse", () => {
    // 300°/s pendant 0,6 s sur 180° : pente initiale 1, donc y1 = x1 = 0,3
    expect(convergenceEasing(300, 180, 600)).toBe("cubic-bezier(0.3, 0.3, 0.36, 1)");
  });

  it("plafonne la courbe quand la vitesse initiale dépasserait ce qu'une cubic-bezier sait suivre", () => {
    expect(convergenceEasing(300, 90, 2000)).toBe("cubic-bezier(0.3, 1, 0.36, 1)");
  });
});

describe("rotationFromTransform", () => {
  it("lit l'angle d'une matrice calculée", () => {
    expect(rotationFromTransform("matrix(0, 1, -1, 0, 0, 0)")).toBeCloseTo(90, 5);
    expect(rotationFromTransform("matrix(0.707107, -0.707107, 0.707107, 0.707107, 0, 0)")).toBeCloseTo(-45, 3);
  });

  it("renvoie 0 sans transformation", () => {
    expect(rotationFromTransform("none")).toBe(0);
    expect(rotationFromTransform("")).toBe(0);
  });
});

describe("couleurs de marque", () => {
  const css = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");

  it("BRAND_HEX reprend les accents de globals.css", () => {
    expect(css).toContain(`--accent: ${BRAND_HEX.accent};`);
    expect(css).toContain(`--secondary: ${BRAND_HEX.secondary};`);
  });

  it("brandMixHex interpole de l'accent au secondaire", () => {
    expect(brandMixHex(0)).toBe(BRAND_HEX.accent);
    expect(brandMixHex(1)).toBe(BRAND_HEX.secondary);
    expect(brandMixHex(0.5)).toBe("#18A8E1");
  });

  it("brandMixCss s'appuie sur les jetons CSS", () => {
    expect(brandMixCss(0)).toBe("var(--accent)");
    expect(brandMixCss(1)).toBe("var(--secondary)");
    expect(brandMixCss(0.25)).toBe("color-mix(in srgb, var(--accent), var(--secondary) 25%)");
  });
});
