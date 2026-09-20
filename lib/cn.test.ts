import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("la dernière classe d'un même groupe l'emporte", () => {
    expect(cn("h-10 px-4", "h-12")).toBe("px-4 h-12");
    expect(cn("bg-accent", "bg-danger")).toBe("bg-danger");
  });

  it("distingue taille et couleur de texte malgré les jetons Relia", () => {
    expect(cn("text-sm text-fg", "text-fg-muted")).toBe("text-sm text-fg-muted");
  });

  it("connaît les ombres, durées et dégradés maison", () => {
    expect(cn("shadow-raised", "shadow-halo")).toBe("shadow-halo");
    expect(cn("duration-hover", "duration-enter")).toBe("duration-enter");
    expect(cn("ease-standard", "ease-in")).toBe("ease-in");
    expect(cn("bg-accent", "bg-gradient-brand")).toBe("bg-accent bg-gradient-brand");
  });

  it("ignore les valeurs vides", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
});
