import type { Metadata } from "next";
import Link from "next/link";
import { ReliaMark } from "@/components/brand/ReliaMark";
import { buttonClasses } from "@/components/ui/button-styles";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false } };

/** Page introuvable (lien périmé, facture effacée, adresse mal saisie). */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      <ReliaMark size={48} isDecorative />
      <p className="text-xs font-semibold tracking-[0.18em] text-fg-muted uppercase">Erreur 404</p>
      <h1 className="font-display text-xl font-semibold">Cette page n&apos;existe pas, ou plus.</h1>
      <p className="text-sm text-fg-muted">
        Le lien est peut-être ancien, ou l&apos;élément a été supprimé au terme de sa durée de conservation.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/app" className={buttonClasses()}>
          Mon espace
        </Link>
        <Link href="/" className={buttonClasses({ variant: "secondary" })}>
          Accueil
        </Link>
      </div>
    </main>
  );
}
