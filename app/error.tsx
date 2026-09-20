"use client";

import { ErrorView } from "@/components/layout/ErrorView";

/** Erreur d'une page publique : message générique, jamais error.message (il peut révéler l'intérieur). */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView reference={error.digest} onRetry={reset} />;
}
