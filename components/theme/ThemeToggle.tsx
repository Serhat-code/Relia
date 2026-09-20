"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * Les deux icônes sont rendues et masquées en CSS selon data-theme :
 * aucun écart d'hydratation, aucun clignotement au chargement.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      aria-label="Basculer entre le thème clair et le thème sombre"
      title="Changer de thème"
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-elevated text-fg-muted transition hover:border-glow hover:text-fg hover:shadow-halo active:scale-[0.97]"
    >
      <Sun aria-hidden className="size-4 light:hidden" />
      <Moon aria-hidden className="hidden size-4 light:block" />
    </button>
  );
}
