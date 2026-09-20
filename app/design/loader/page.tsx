import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { isProductionDeployment } from "@/lib/env";
import { InContextExamples } from "./_components/InContextExamples";
import { LoaderPlayground } from "./_components/LoaderPlayground";
import { MarkGallery } from "./_components/MarkGallery";

export const metadata: Metadata = {
  title: "Loader",
  robots: { index: false, follow: false },
};

// Page de vérification interne : jamais servie sur le déploiement de production.
export default function LoaderDemoPage() {
  if (isProductionDeployment()) notFound();

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-16 flex items-start justify-between gap-6">
        <div>
          <Link href="/design" className="text-sm font-medium text-link underline-offset-4 hover:underline">
            ← Jetons de design
          </Link>
          <p className="mt-6 text-xs font-medium tracking-[0.2em] text-fg-muted uppercase">Palier 2 · Signature</p>
          <h1 className="mt-3 text-2xl font-semibold">
            <span className="text-gradient-brand">ReliaLoader</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-fg-muted">
            Facture émise → relance envoyée → promesse obtenue → encaissement. Utilisé partout : chargement de page,
            import, envoi de relance, synchronisation.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex flex-col gap-20">
        <LoaderPlayground />
        <MarkGallery />
        <InContextExamples />
      </div>
    </main>
  );
}
