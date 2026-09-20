import { describe, expect, it } from "vitest";
import { findPromisedDate, MAX_PROMISE_HORIZON_DAYS } from "./promise-date";

/** Réponse reçue le lundi 21 septembre 2026. */
const MONDAY = "2026-09-21";

describe("findPromisedDate", () => {
  it.each([
    ["Je vous règle le 30/09.", "2026-09-30"],
    ["Virement le 30.09.2026", "2026-09-30"],
    ["Paiement prévu le 2 octobre", "2026-10-02"],
    ["Règlement le 1er octobre", "2026-10-01"],
    ["Le virement partira vendredi", "2026-09-25"],
    ["Je paie lundi", "2026-09-28"],
    ["vendredi 2 octobre sans faute", "2026-10-02"],
    ["Règlement sous huitaine", "2026-09-29"],
    ["Règlement sous quinzaine", "2026-10-06"],
    ["d'ici la fin du mois", "2026-09-30"],
    ["fin octobre au plus tard", "2026-10-31"],
    ["début du mois prochain", "2026-10-05"],
    ["la semaine prochaine", "2026-10-02"],
    ["en fin de semaine", "2026-09-25"],
    ["demain matin", "2026-09-22"],
    ["après-demain", "2026-09-23"],
    ["dans 10 jours", "2026-10-01"],
    ["sous quinze jours", "2026-10-06"],
    ["aujourd'hui même", MONDAY],
  ])("« %s » → %s", (text, expected) => {
    expect(findPromisedDate(text, MONDAY)?.date).toBe(expected);
  });

  it("garde le libellé trouvé, pour l'afficher", () => {
    expect(findPromisedDate("Je règle Vendredi.", MONDAY)).toEqual({ date: "2026-09-25", label: "vendredi" });
  });

  it("retient la première date plausible du texte", () => {
    expect(findPromisedDate("Je règle le 30/09, puis la suivante le 15/10.", MONDAY)?.date).toBe("2026-09-30");
  });

  it("passe au 1er janvier suivant en fin d'année", () => {
    expect(findPromisedDate("Je paierai le 5 janvier", "2026-12-28")?.date).toBe("2027-01-05");
  });

  it("ignore une date passée", () => {
    expect(findPromisedDate("Je vous avais écrit le 15/09/2026.", MONDAY)).toBeNull();
  });

  it("ne lit pas « 2 mais » comme « 2 mai »", () => {
    expect(findPromisedDate("J'en ai 2 mais pas plus.", "2026-04-20")).toBeNull();
    expect(findPromisedDate("Réglé le 2 mai.", "2026-04-20")?.date).toBe("2026-05-02");
  });

  it(`ignore une date au-delà de ${MAX_PROMISE_HORIZON_DAYS} jours`, () => {
    expect(findPromisedDate("Règlement le 15/03/2027", MONDAY)).toBeNull();
  });

  it.each([
    ["un montant avec décimales", "Il reste 12.50 € à payer."],
    ["un montant avec milliers", "Montant : 4.820,00 €"],
    ["une date impossible", "le 31/02"],
    ["un texte sans date", "Je vous règle dès que possible."],
  ])("ne prend pas %s pour une date", (_case, text) => {
    expect(findPromisedDate(text, MONDAY)).toBeNull();
  });
});
