"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { ReliaMark } from "@/components/brand/ReliaMark";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/button-styles";

type ErrorViewProps = {
  /** Référence de l'erreur côté serveur (digest), à communiquer au support ; jamais le message technique. */
  reference?: string;
  onRetry: () => void;
  homeHref?: string;
};

/** Écran d'erreur : une phrase claire, une nouvelle tentative, et rien de ce qui s'est passé à l'intérieur. */
export function ErrorView({ reference, onRetry, homeHref = "/" }: ErrorViewProps) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-24 text-center">
      <ReliaMark size={48} isDecorative />
      <h1 className="font-display text-xl font-semibold">Un incident nous empêche d&apos;afficher cette page.</h1>
      <p className="text-sm text-fg-muted">
        Vos données ne sont pas touchées. Réessayez dans un instant ; si le problème persiste, écrivez-nous en indiquant la
        référence ci-dessous.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button icon={<RotateCcw aria-hidden />} onClick={onRetry}>
          Réessayer
        </Button>
        <Link href={homeHref} className={buttonClasses({ variant: "secondary" })}>
          Revenir à l&apos;accueil
        </Link>
      </div>
      {reference && (
        <p className="text-xs text-fg-muted">
          Référence : <code className="tabular-nums">{reference}</code>
        </p>
      )}
    </div>
  );
}
