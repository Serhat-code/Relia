import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type RowLinkProps = { href: string; isPrimary?: boolean; children: ReactNode };

/**
 * Ligne de tableau entièrement cliquable : chaque cellule porte le lien, seul le premier est
 * atteignable au clavier (les autres doublonneraient les arrêts de tabulation). Leur texte reste
 * lu par les lecteurs d'écran : montant, échéance et statut ne doivent pas disparaître. La cellule
 * qui l'accueille est sans marge intérieure (`className="p-0"`) : le lien occupe toute sa surface.
 */
export function RowLink({ href, isPrimary = false, children }: RowLinkProps) {
  return (
    <Link
      href={href}
      tabIndex={isPrimary ? undefined : -1}
      className={cn(
        "flex min-h-14 flex-col justify-center gap-0.5 px-4 py-2.5 whitespace-nowrap outline-none",
        isPrimary && "rounded-l-xl focus-visible:ring-3 focus-visible:ring-accent/40",
      )}
    >
      {children}
    </Link>
  );
}
