export const THEMES = ["dark", "light"] as const;

export type Theme = (typeof THEMES)[number];

/** Le thème sombre est le thème par défaut de l'application (CLAUDE.md §6). */
export const DEFAULT_THEME: Theme = "dark";

export const THEME_STORAGE_KEY = "relia-theme";
