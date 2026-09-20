import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/design/contrast";

const GLOBALS_CSS = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
);

/** Palette sombre imposée par le cahier des charges (CLAUDE.md §6). */
const SPEC_DARK_PALETTE: Record<string, string> = {
  bg: "#070B14",
  "bg-elevated": "#0E1526",
  surface: "#16203A",
  border: "#243250",
  "border-glow": "#2F6BFF33",
  accent: "#2F6BFF",
  "accent-hover": "#4B82FF",
  "accent-soft": "#2F6BFF1A",
  secondary: "#00E5C2",
  success: "#22D18C",
  warning: "#FFB020",
  danger: "#FF4D6A",
  text: "#E8EEF9",
  "text-muted": "#8A9BB8",
  "text-subtle": "#5A6B88",
  "gradient-brand": "linear-gradient(135deg, #2F6BFF 0%, #00E5C2 100%)",
  "gradient-glow": "radial-gradient(circle at 50% 0%, #2F6BFF26 0%, transparent 70%)",
};

function extractBlock(selectorPattern: RegExp): string {
  const match = selectorPattern.exec(GLOBALS_CSS);
  if (!match?.[1]) {
    throw new Error(`Bloc introuvable dans globals.css : ${selectorPattern}`);
  }
  return match[1];
}

function parseCustomProperties(block: string): Map<string, string> {
  const declarations = [...block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)];
  return new Map(declarations.map(([, name = "", value = ""]) => [name, value.trim()]));
}

const normalize = (value: string) => value.replace(/\s+/g, " ").toLowerCase();

const darkTokens = parseCustomProperties(
  extractBlock(/:root,\s*\[data-theme="dark"\]\s*\{([^}]*)\}/),
);
const lightTokens = parseCustomProperties(extractBlock(/\[data-theme="light"\]\s*\{([^}]*)\}/));

/** Préfixes Tailwind qui acceptent une couleur : bg-<couleur>, shadow-<couleur>… */
const COLOR_UTILITY_PREFIXES = [
  "bg",
  "text",
  "border",
  "ring",
  "shadow",
  "outline",
  "fill",
  "stroke",
  "decoration",
  "divide",
  "caret",
  "accent",
  "placeholder",
  "from",
  "via",
  "to",
] as const;

function themeKeys(namespace: string): string[] {
  return [...GLOBALS_CSS.matchAll(new RegExp(`--${namespace}-([\\w-]+)\\s*:`, "g"))]
    .map(([, name = ""]) => name)
    .filter((name) => name !== "*");
}

describe("noms d'utilitaires", () => {
  const colorNames = themeKeys("color");
  const colorUtilities = new Set(
    COLOR_UTILITY_PREFIXES.flatMap((prefix) => colorNames.map((color) => `${prefix}-${color}`)),
  );

  // Exemple réel : une couleur « glow » fabrique bg-glow (fond uni), qui s'ajoutait
  // silencieusement à l'utilitaire maison bg-glow (dégradé).
  it("aucun utilitaire maison ne reprend le nom d'un utilitaire de couleur", () => {
    const customUtilities = [...GLOBALS_CSS.matchAll(/@utility\s+([\w-]+)/g)].map(([, name = ""]) => name);

    expect(customUtilities.length).toBeGreaterThan(0);
    expect(customUtilities.filter((name) => colorUtilities.has(name))).toEqual([]);
  });

  it("aucune ombre ne porte le nom d'une couleur", () => {
    expect(themeKeys("shadow").filter((name) => colorNames.includes(name))).toEqual([]);
  });
});

describe("jetons de thème", () => {
  it.each(Object.entries(SPEC_DARK_PALETTE))(
    "le thème sombre définit --%s conformément au cahier des charges",
    (name, expected) => {
      expect(normalize(darkTokens.get(name) ?? "")).toBe(normalize(expected));
    },
  );

  it("le thème clair définit exactement les mêmes variables que le thème sombre", () => {
    expect([...lightTokens.keys()].sort()).toEqual([...darkTokens.keys()].sort());
  });

  it("le thème clair utilise le fond #FAFBFD", () => {
    expect(normalize(lightTokens.get("bg") ?? "")).toBe(normalize("#FAFBFD"));
  });

  it.each(["accent", "secondary", "gradient-brand"])(
    "le thème clair garde le même --%s que le thème sombre",
    (name) => {
      expect(lightTokens.get(name)).toBe(darkTokens.get(name));
    },
  );
});

/**
 * Contrastes WCAG AA. 4,5:1 pour tout texte courant ; 3:1 pour --text-subtle,
 * réservé aux grands textes, icônes, champs désactivés et textes d'exemple.
 */
const CONTRAST_RULES = [
  { text: "text", backgrounds: ["bg", "bg-elevated", "surface"], minimum: 4.5 },
  { text: "text-muted", backgrounds: ["bg", "bg-elevated", "surface"], minimum: 4.5 },
  { text: "accent-text", backgrounds: ["bg", "bg-elevated"], minimum: 4.5 },
  { text: "success", backgrounds: ["bg", "bg-elevated"], minimum: 4.5 },
  { text: "warning", backgrounds: ["bg", "bg-elevated"], minimum: 4.5 },
  { text: "danger", backgrounds: ["bg", "bg-elevated"], minimum: 4.5 },
  { text: "text-subtle", backgrounds: ["bg", "bg-elevated"], minimum: 3 },
  { text: "danger-fg", backgrounds: ["danger"], minimum: 4.5 },
] as const;

const THEME_TOKENS = [
  ["sombre", darkTokens],
  ["clair", lightTokens],
] as const;

const contrastCases = THEME_TOKENS.flatMap(([theme, tokens]) =>
  CONTRAST_RULES.flatMap(({ text, backgrounds, minimum }) =>
    backgrounds.map((background) => ({ theme, tokens, text, background, minimum })),
  ),
);

describe("contrastes", () => {
  it.each(contrastCases)(
    "$theme : --$text sur --$background atteint $minimum:1",
    ({ tokens, text, background, minimum }) => {
      const ratio = contrastRatio(tokens.get(text) ?? "", tokens.get(background) ?? "");

      expect(ratio).toBeGreaterThanOrEqual(minimum);
    },
  );
});
