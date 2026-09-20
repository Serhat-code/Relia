import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DURATION, MAX_UI_DURATION } from "@/lib/design/motion";

const GLOBALS_CSS = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
);

function cssDurationSeconds(name: string): number | undefined {
  const match = new RegExp(`--${name}:\\s*(\\d+)ms;`).exec(GLOBALS_CSS);
  return match?.[1] ? Number(match[1]) / 1000 : undefined;
}

describe("durées d'animation", () => {
  it.each(Object.entries(DURATION))(
    "duration-%s a la même valeur en CSS et pour Framer Motion",
    (name, seconds) => {
      expect(cssDurationSeconds(`transition-duration-${name}`)).toBe(seconds);
    },
  );

  it("la transition par défaut (survol) vaut la durée de survol", () => {
    expect(cssDurationSeconds("default-transition-duration")).toBe(DURATION.hover);
  });

  it("aucune durée d'interface ne dépasse 400 ms", () => {
    expect(Math.max(...Object.values(DURATION))).toBeLessThanOrEqual(MAX_UI_DURATION);
  });

  it("les transitions de page restent à 320 ms", () => {
    expect(DURATION.page).toBe(0.32);
  });
});
