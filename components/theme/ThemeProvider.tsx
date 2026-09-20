"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, THEMES } from "@/lib/design/theme";

/** Le nonce de la requête autorise le petit script qui pose le thème avant l'affichage (CSP). */
export function ThemeProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider
      nonce={nonce}
      attribute="data-theme"
      defaultTheme={DEFAULT_THEME}
      themes={[...THEMES]}
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
