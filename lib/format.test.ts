import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatDateTime, formatDays, formatNumber, pluralize } from "./format";

/** Intl fr-FR sépare les milliers par une espace fine insécable (U+202F). */
const NNBSP = "\u202F";
const NBSP = "\u00A0";

describe("formatCurrency", () => {
  it("formate un montant en euros à la française", () => {
    expect(formatCurrency(12480)).toBe(`12${NNBSP}480,00${NBSP}€`);
  });

  it("arrondit au centime", () => {
    expect(formatCurrency(0.125)).toBe(`0,13${NBSP}€`);
  });

  it("accepte une autre devise", () => {
    expect(formatCurrency(1500, "USD")).toBe(`1${NNBSP}500,00${NBSP}$US`);
  });

  it("affiche un tiret plutôt que « NaN € » pour un montant non numérique", () => {
    expect(formatCurrency(Number.NaN)).toBe("—");
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatNumber", () => {
  it("sépare les milliers à la française, sans décimale", () => {
    expect(formatNumber(1234.4)).toBe(`1${NNBSP}234`);
  });

  it("affiche un tiret pour une valeur non numérique", () => {
    expect(formatNumber(Number.NaN)).toBe("—");
  });
});

describe("formatDays", () => {
  it("accorde « jour » au pluriel à partir de 2", () => {
    expect(formatDays(0)).toBe("0 jour");
    expect(formatDays(1)).toBe("1 jour");
    expect(formatDays(52)).toBe("52 jours");
  });

  it("arrondit au jour près", () => {
    expect(formatDays(12.6)).toBe("13 jours");
  });

  it("affiche un tiret pour une valeur non numérique", () => {
    expect(formatDays(Number.NaN)).toBe("—");
  });
});

describe("formatDate", () => {
  it("formate une date au fuseau de Paris, indépendamment du fuseau du serveur", () => {
    // 23 h 30 UTC le 31 décembre = 1er janvier à Paris
    expect(formatDate("2026-12-31T23:30:00Z")).toBe("01/01/2027");
  });

  it("accepte un objet Date", () => {
    expect(formatDate(new Date("2026-09-18T10:00:00Z"))).toBe("18/09/2026");
  });

  it("affiche un tiret au lieu de planter sur une date invalide", () => {
    expect(formatDate("pas-une-date")).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate(new Date(Number.NaN))).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("affiche date et heure de Paris, quel que soit le fuseau du serveur", () => {
    expect(formatDateTime("2026-09-18T12:32:00Z")).toBe("18/09/2026 à 14:32");
  });

  it("affiche un tiret pour une valeur invalide", () => {
    expect(formatDateTime("pas-une-date")).toBe("—");
  });
});

describe("pluralize", () => {
  it("accorde au singulier pour 0 et 1, au pluriel à partir de 2 (règle française)", () => {
    expect(pluralize(0, "facture", "factures")).toBe("facture");
    expect(pluralize(1, "facture", "factures")).toBe("facture");
    expect(pluralize(2, "facture", "factures")).toBe("factures");
  });
});

describe("formatCurrency avec une devise mal formée", () => {
  it("affiche le montant et le code plutôt que de faire échouer la page", () => {
    expect(formatCurrency(12, "EU")).toBe("12,00 EU");
  });
});
