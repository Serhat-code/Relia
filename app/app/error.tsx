"use client";

import { ErrorView } from "@/components/layout/ErrorView";

/** Erreur dans l'espace client : le cadre (navigation) reste en place, la page seule est remplacée. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView reference={error.digest} onRetry={reset} homeHref="/app" />;
}
