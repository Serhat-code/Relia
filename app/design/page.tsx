import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { isProductionDeployment } from "@/lib/env";
import { ColorTokens } from "./_components/ColorTokens";
import { MotionTokens } from "./_components/MotionTokens";
import { ThemePreview } from "./_components/ThemePreview";
import { TypeScale } from "./_components/TypeScale";

export const metadata: Metadata = {
  title: "Jetons de design",
  robots: { index: false, follow: false },
};

// Page de vérification interne : jamais servie sur le déploiement de production.
export default function DesignPage() {
  if (isProductionDeployment()) notFound();

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-16 flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-medium tracking-[0.2em] text-fg-muted uppercase">Palier 1 · Fondations</p>
          <h1 className="mt-3 text-2xl font-semibold">
            Jetons de design <span className="text-gradient-brand">Relia</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-fg-muted">
            Couleurs, typographie, mouvement et thèmes. Tout composant de l&apos;application s&apos;appuie
            exclusivement sur ces jetons : la palette Tailwind par défaut est désactivée.
          </p>
          <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
            <Link href="/design/loader" className="text-link underline-offset-4 hover:underline">
              Palier 2 · ReliaLoader →
            </Link>
            <Link href="/design/composants" className="text-link underline-offset-4 hover:underline">
              Palier 3 · Composants →
            </Link>
            <Link href="/design/app" className="text-link underline-offset-4 hover:underline">
              Palier 5 · Cadre de l&apos;application →
            </Link>
            <Link href="/design/factures" className="text-link underline-offset-4 hover:underline">
              Palier 6 · Factures →
            </Link>
            <Link href="/design/debiteurs" className="text-link underline-offset-4 hover:underline">
              Palier 7 · Débiteurs →
            </Link>
            <Link href="/design/modeles" className="text-link underline-offset-4 hover:underline">
              Palier 8 · Modèles et scénarios →
            </Link>
            <Link href="/design/boite-mail" className="text-link underline-offset-4 hover:underline">
              Palier 9 · Boîte d&apos;envoi →
            </Link>
            <Link href="/design/relances" className="text-link underline-offset-4 hover:underline">
              Palier 10 · Relances →
            </Link>
            <Link href="/design/reponses" className="text-link underline-offset-4 hover:underline">
              Palier 11 · Réponses et promesses →
            </Link>
            <Link href="/design/tableau-de-bord" className="text-link underline-offset-4 hover:underline">
              Palier 12 · Tableau de bord →
            </Link>
            <Link href="/design/journal" className="text-link underline-offset-4 hover:underline">
              Palier 12 · Journal →
            </Link>
            <Link href="/design/parametres" className="text-link underline-offset-4 hover:underline">
              Palier 13 · Paramètres et abonnement →
            </Link>
          </nav>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex flex-col gap-20">
        <ColorTokens />
        <TypeScale />
        <MotionTokens />
        <ThemePreview />
      </div>
    </main>
  );
}
