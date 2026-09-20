import { describe, expect, it } from "vitest";
import { debtorListHref, parseDebtorListQuery } from "./list-query";

describe("parseDebtorListQuery", () => {
  it("par défaut : tous les débiteurs, première page", () => {
    expect(parseDebtorListQuery({})).toEqual({ filter: "all", search: "", page: 1 });
  });

  it("lit le type, la recherche et la page, et ignore les valeurs inconnues", () => {
    expect(parseDebtorListQuery({ type: "particuliers", q: " Fournil ", page: "2" })).toEqual({
      filter: "b2c",
      search: "Fournil",
      page: 2,
    });
    expect(parseDebtorListQuery({ type: "b2b", page: "0" })).toEqual({ filter: "all", search: "", page: 1 });
  });
});

describe("debtorListHref", () => {
  it("omet les valeurs par défaut", () => {
    expect(debtorListHref({ filter: "all", search: "", page: 1 })).toBe("/app/debiteurs");
    expect(debtorListHref({ filter: "b2b", search: "Caradec", page: 3 })).toBe(
      "/app/debiteurs?type=professionnels&q=Caradec&page=3",
    );
  });
});
