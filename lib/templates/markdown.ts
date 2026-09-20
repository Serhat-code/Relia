/**
 * Markdown minimal des modèles (paragraphes, retours à la ligne, **gras**) sous forme de blocs :
 * l'aperçu est rendu par React, sans HTML injecté.
 */
export type TextRun = { text: string; isBold: boolean };
export type Paragraph = TextRun[][];

export function markdownBlocks(markdown: string): Paragraph[] {
  return markdown
    .trim()
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim() !== "")
    .map((paragraph) =>
      paragraph
        .trim()
        .split("\n")
        .map((line) =>
          line
            .split(/(\*\*.+?\*\*)/g)
            .filter((part) => part !== "")
            .map((part) =>
              part.startsWith("**") && part.endsWith("**") && part.length > 4
                ? { text: part.slice(2, -2), isBold: true }
                : { text: part, isBold: false },
            ),
        ),
    );
}
