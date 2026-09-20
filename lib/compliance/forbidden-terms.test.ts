import { describe, expect, it } from "vitest";
import { findForbiddenTerms } from "./forbidden-terms";

describe("findForbiddenTerms", () => {
  it("détecte « recouvrement » quelle que soit la casse", () => {
    const matches = findForbiddenTerms("Service de Recouvrement");

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ term: "recouvrement", line: 1, column: 12 });
  });

  it("détecte « recouvrement de créances »", () => {
    expect(findForbiddenTerms("recouvrement de créances")).toHaveLength(1);
  });

  it("détecte « agence » au singulier, quelle que soit la casse", () => {
    expect(findForbiddenTerms("Notre agence")).toHaveLength(1);
    expect(findForbiddenTerms("AGENCE")).toHaveLength(1);
  });

  it("autorise « agences » au pluriel pour désigner la clientèle cible", () => {
    expect(findForbiddenTerms("Pour les TPE, PME, freelances et agences")).toEqual([]);
  });

  it("détecte toujours « agences de recouvrement » par le mot « recouvrement »", () => {
    expect(findForbiddenTerms("agences de recouvrement").map((match) => match.term)).toEqual([
      "recouvrement",
    ]);
  });

  it("ignore les mots qui contiennent un terme sans être ce terme", () => {
    expect(findForbiddenTerms("agencement des colonnes, colonnes agencées")).toEqual([]);
  });

  it("indique la ligne de chaque occurrence", () => {
    const matches = findForbiddenTerms("relance\nrelance\nune agence");

    expect(matches.map((match) => match.line)).toEqual([3]);
  });

  it("n'accuse pas le vocabulaire autorisé", () => {
    expect(findForbiddenTerms("Relance, suivi des règlements, encaissement.")).toEqual([]);
  });
});
