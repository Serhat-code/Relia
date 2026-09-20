import { describe, expect, it } from "vitest";
import { exportFileName } from "./export";

describe("exportFileName", () => {
  it("produit un nom de fichier sûr à partir du nom du client", () => {
    expect(exportFileName("Menuiserie Caradec & Fils", "2026-09-19")).toBe(
      "relia-client-menuiserie-caradec-fils-2026-09-19.json",
    );
    expect(exportFileName('Hôtel "L\'Été"/../', "2026-09-19")).toBe("relia-client-hotel-l-ete-2026-09-19.json");
    expect(exportFileName("€€€", "2026-09-19")).toBe("relia-client-sans-nom-2026-09-19.json");
  });
});
