import { describe, expect, it } from "vitest";
import { parsePromiseForm, promiseDeadline, PROMISE_GRACE_DAYS } from "./promises";

const TODAY = "2026-09-21";

describe("parsePromiseForm", () => {
  it("accepte une date à venir, sans montant (la totalité)", () => {
    expect(parsePromiseForm({ promisedDate: "2026-09-30", promisedAmount: " " }, TODAY, 1200)).toEqual({
      ok: true,
      value: { promisedDate: "2026-09-30", promisedAmount: null },
    });
  });

  it("lit un montant partiel au format français", () => {
    expect(parsePromiseForm({ promisedDate: TODAY, promisedAmount: "1 000,50" }, TODAY, 1200)).toEqual({
      ok: true,
      value: { promisedDate: TODAY, promisedAmount: 1000.5 },
    });
  });

  it.each([
    [{ promisedDate: "", promisedAmount: "" }, "Indiquez la date promise."],
    [{ promisedDate: "30/09/2026", promisedAmount: "" }, "Indiquez la date promise."],
    [{ promisedDate: "2027-02-30", promisedAmount: "" }, "Indiquez la date promise."],
    [{ promisedDate: "2026-09-20", promisedAmount: "" }, "La date promise ne peut pas être passée."],
    [{ promisedDate: "2027-09-22", promisedAmount: "" }, "La date promise doit être dans l'année qui vient."],
    [{ promisedDate: "2026-09-30", promisedAmount: "abc" }, "Montant invalide."],
    [{ promisedDate: "2026-09-30", promisedAmount: "0" }, "Montant invalide."],
    [{ promisedDate: "2026-09-30", promisedAmount: "1 200,01" }, "Le montant promis dépasse celui de la facture."],
    [{ promisedDate: 20260930 }, "Promesse invalide."],
  ])("refuse %j", (input, error) => {
    expect(parsePromiseForm(input, TODAY, 1200)).toEqual({ ok: false, error });
  });
});

describe("promiseDeadline", () => {
  it(`laisse ${PROMISE_GRACE_DAYS} jours de grâce après la date promise`, () => {
    expect(promiseDeadline("2026-09-30")).toBe("2026-10-03");
  });
});
