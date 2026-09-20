import { describe, expect, it } from "vitest";
import { markdownBlocks } from "./markdown";

describe("markdownBlocks", () => {
  it("découpe en paragraphes, lignes et passages en gras", () => {
    expect(markdownBlocks("Bonjour,\n\n**Montant dû :** 1 200 €\nÉchéance : 31/08\n\n\nMerci")).toEqual([
      [[{ text: "Bonjour,", isBold: false }]],
      [
        [
          { text: "Montant dû :", isBold: true },
          { text: " 1 200 €", isBold: false },
        ],
        [{ text: "Échéance : 31/08", isBold: false }],
      ],
      [[{ text: "Merci", isBold: false }]],
    ]);
  });

  it("laisse le HTML tel quel, en texte", () => {
    expect(markdownBlocks("<script>x</script>")).toEqual([[[{ text: "<script>x</script>", isBold: false }]]]);
  });
});
