import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

describe("contrastRatio", () => {
  it("vaut 21 entre le blanc et le noir", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
  });

  it("vaut 1 entre deux couleurs identiques", () => {
    expect(contrastRatio("#2F6BFF", "#2F6BFF")).toBe(1);
  });

  it("ne dépend pas de l'ordre des couleurs", () => {
    expect(contrastRatio("#070B14", "#E8EEF9")).toBe(contrastRatio("#E8EEF9", "#070B14"));
  });

  it("refuse une couleur avec transparence", () => {
    expect(() => contrastRatio("#2F6BFF33", "#000000")).toThrow(/#RRGGBB/);
  });
});
