import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { STAGGER_DELAY } from "@/lib/design/motion";

type RevealProps = {
  /** Rang du bloc dans la page : 40 ms de décalage par rang (cascade). */
  index?: number;
  className?: string;
  children: ReactNode;
};

/**
 * Bloc de page qui apparaît en fondu avec une translation de 8 px (CLAUDE.md §6). En CSS pur :
 * visible dès le rendu serveur, rejoué à chaque navigation (nouveaux nœuds), coupé si
 * l'utilisateur réduit les animations.
 */
export function Reveal({ index = 0, className, children }: RevealProps) {
  return (
    <div
      className={cn("animate-page-in motion-reduce:animate-none", className)}
      style={{ animationDelay: `${Math.round(index * STAGGER_DELAY * 1000)}ms` }}
    >
      {children}
    </div>
  );
}
