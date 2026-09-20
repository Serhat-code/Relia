import { cn } from "@/lib/cn";

/**
 * Bloc de chargement avec balayage lumineux (pas de spinner nu, CLAUDE.md §6).
 * Masqué aux lecteurs d'écran : le conteneur annonce le chargement (aria-busy, ou un
 * ReliaLoader avec libellé).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-md bg-surface",
        "before:absolute before:inset-0 before:animate-shimmer before:bg-linear-to-r",
        "before:from-transparent before:via-fg/6 before:to-transparent motion-reduce:before:hidden",
        className,
      )}
    />
  );
}
