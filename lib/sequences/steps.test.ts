import { describe, expect, it } from "vitest";
import { describeOffset, validateSteps, type StepDraft } from "./steps";

const step = (offsetDays: number, tone: StepDraft["tone"] = "courtois"): StepDraft => ({
  id: null,
  offsetDays,
  tone,
  templateId: null,
});

describe("validateSteps (mêmes règles que public.save_sequence_steps)", () => {
  it("accepte le scénario B2B par défaut", () => {
    expect(validateSteps([step(-3), step(7), step(15, "ferme"), step(30, "mise_en_demeure")])).toEqual({ ok: true });
  });

  it("exige de 1 à 8 étapes", () => {
    expect(validateSteps([])).toEqual({ ok: false, message: "Un scénario compte de 1 à 8 étapes.", stepErrors: {} });
    expect(validateSteps(Array.from({ length: 9 }, (_, index) => step(index + 1)))).toMatchObject({ ok: false });
  });

  it("signale chaque étape fautive", () => {
    expect(validateSteps([step(10), step(5), step(400)])).toEqual({
      ok: false,
      message: "Corrigez les étapes signalées.",
      stepErrors: {
        1: "Chaque étape doit venir après la précédente.",
        2: "Entre 60 jours avant et 365 jours après l'échéance.",
      },
    });
  });

  it("n'accepte un ton ferme qu'après l'échéance", () => {
    expect(validateSteps([step(-5, "ferme")])).toMatchObject({
      ok: false,
      stepErrors: { 0: "Un ton ferme ou une mise en demeure vient après l'échéance." },
    });
  });
});

describe("describeOffset", () => {
  it("décrit l'étape par rapport à l'échéance", () => {
    expect(describeOffset(-3)).toBe("3 jours avant l'échéance");
    expect(describeOffset(-1)).toBe("1 jour avant l'échéance");
    expect(describeOffset(0)).toBe("le jour de l'échéance");
    expect(describeOffset(15)).toBe("15 jours après l'échéance");
  });
});
