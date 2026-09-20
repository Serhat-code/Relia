import { describe, expect, it } from "vitest";
import { decodeText, parseCsv } from "./csv-file";

const encode = (text: string) => new TextEncoder().encode(text);

describe("decodeText", () => {
  it("lit l'UTF-8, avec ou sans BOM", () => {
    const BOM = String.fromCharCode(0xfeff);

    expect(decodeText(encode(`${BOM}Échéance`))).toBe("Échéance");
    expect(decodeText(encode("Échéance"))).toBe("Échéance");
  });

  it("retombe sur Windows-1252, l'encodage des exports Excel français", () => {
    // « Échéance » en Windows-1252 : É = 0xC9, é = 0xE9.
    const bytes = new Uint8Array([0xc9, 0x63, 0x68, 0xe9, 0x61, 0x6e, 0x63, 0x65]);

    expect(decodeText(bytes)).toBe("Échéance");
  });
});

describe("parseCsv", () => {
  it("détecte le point-virgule et lit les en-têtes", () => {
    const result = parseCsv(encode("Numéro;Client;Montant TTC\nF-1;Caradec;1 200,00\n\nF-2;Fournil;80\n"));

    expect(result).toEqual({
      ok: true,
      headers: ["Numéro", "Client", "Montant TTC"],
      records: [
        { Numéro: "F-1", Client: "Caradec", "Montant TTC": "1 200,00" },
        { Numéro: "F-2", Client: "Fournil", "Montant TTC": "80" },
      ],
    });
  });

  it("complète les cellules manquantes par du vide", () => {
    const result = parseCsv(encode("a,b,c\n1,2\n"));

    expect(result.ok && result.records).toEqual([{ a: "1", b: "2", c: "" }]);
  });

  it("explique un fichier vide ou sans facture", () => {
    expect(parseCsv(encode(""))).toEqual({ ok: false, error: "Ce fichier est vide." });
    expect(parseCsv(encode("Numéro;Client\n"))).toEqual({ ok: false, error: "Ce fichier ne contient aucune facture." });
  });

  it("refuse plus de 2000 factures en un import", () => {
    const lines = Array.from({ length: 2001 }, (_, index) => `F-${index};Client`);

    expect(parseCsv(encode(`Numéro;Client\n${lines.join("\n")}`))).toEqual({
      ok: false,
      error: "Ce fichier compte 2001 lignes : 2000 au maximum par import. Découpez-le en plusieurs fichiers.",
    });
  });
});
