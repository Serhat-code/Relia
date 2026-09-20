import { describe, expect, it } from "vitest";
import { formatSiren, isValidSiren, normalizeSiren } from "./siren";

describe("SIREN", () => {
  it("accepte un numéro de 9 chiffres dont la clé de contrôle (Luhn) est juste", () => {
    expect(isValidSiren("123456782")).toBe(true);
    expect(isValidSiren("900000019")).toBe(true);
  });

  it("refuse une clé de contrôle fausse", () => {
    expect(isValidSiren("123456789")).toBe(false);
  });

  it("refuse tout ce qui n'a pas exactement 9 chiffres", () => {
    expect(isValidSiren("12345678")).toBe(false);
    expect(isValidSiren("1234567820")).toBe(false);
    expect(isValidSiren("12345678A")).toBe(false);
  });

  it("normalise la saisie : espaces et points retirés", () => {
    expect(normalizeSiren(" 123 456 782 ")).toBe("123456782");
    expect(normalizeSiren("123.456.782")).toBe("123456782");
  });
});

describe("formatSiren", () => {
  it("groupe les chiffres par trois, et laisse intacte une valeur inattendue", () => {
    expect(formatSiren("123456782")).toBe("123 456 782");
    expect(formatSiren("12345")).toBe("12345");
  });
});
