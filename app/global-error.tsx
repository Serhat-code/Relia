"use client";

import "./globals.css";

/**
 * Dernier recours, quand le gabarit racine lui-même échoue : page autonome, sans dépendance au thème
 * ni aux polices, et sans aucun détail technique.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr" data-theme="dark">
      <body className="bg-canvas text-fg">
        <main role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
          <h1 className="text-xl font-semibold">Relia est momentanément indisponible.</h1>
          <p className="text-sm text-fg-muted">Vos données ne sont pas touchées. Réessayez dans un instant.</p>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition duration-hover hover:bg-accent-hover"
          >
            Réessayer
          </button>
          {error.digest && <p className="text-xs text-fg-muted">Référence : {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
