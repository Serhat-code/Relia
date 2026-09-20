import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { isProductionDeployment } from "@/lib/env";
import { BadgesShowcase } from "./_components/BadgesShowcase";
import { ButtonsShowcase } from "./_components/ButtonsShowcase";
import { CardsShowcase } from "./_components/CardsShowcase";
import { FieldsShowcase } from "./_components/FieldsShowcase";
import { OverlaysShowcase } from "./_components/OverlaysShowcase";
import { SkeletonShowcase } from "./_components/SkeletonShowcase";
import { TableShowcase } from "./_components/TableShowcase";

export const metadata: Metadata = {
  title: "Composants",
  robots: { index: false, follow: false },
};

// Page de vérification interne : jamais servie sur le déploiement de production.
export default function ComponentsDemoPage() {
  if (isProductionDeployment()) notFound();

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-16 flex items-start justify-between gap-6">
        <div>
          <Link href="/design" className="text-sm font-medium text-link underline-offset-4 hover:underline">
            ← Jetons de design
          </Link>
          <p className="mt-6 text-xs font-medium tracking-[0.2em] text-fg-muted uppercase">Palier 3 · Composants</p>
          <h1 className="mt-3 text-2xl font-semibold">
            Bibliothèque <span className="text-gradient-brand">Relia</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-fg-muted">
            Bouton, carte, tableau, badge, champ, modale, toast, squelette. Faits maison, sur les jetons du palier 1 ;
            survol et pression en 220 ms, apparitions et toasts en 280 ms.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex flex-col gap-20">
        <ButtonsShowcase />
        <BadgesShowcase />
        <CardsShowcase />
        <TableShowcase />
        <FieldsShowcase />
        <OverlaysShowcase />
        <SkeletonShowcase />
      </div>
    </main>
  );
}
