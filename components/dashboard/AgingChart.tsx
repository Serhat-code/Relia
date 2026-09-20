import type { AgingBucket } from "@/lib/dashboard/summary";
import { formatCurrency } from "@/lib/format";

const percent = (share: number) => `${Math.round(share * 100)} %`;

/**
 * Ancienneté des retards : une barre par tranche, longueur proportionnelle au montant (une seule
 * grandeur, donc une seule couleur et pas de légende). Chaque valeur est écrite au bout de sa barre, dans
 * une colonne à elle : la barre se partage l'espace restant, même sur un écran étroit. La part du retard
 * total s'affiche au survol ou au clavier, et reste lue par les lecteurs d'écran.
 */
export function AgingChart({ buckets, currency }: { buckets: readonly AgingBucket[]; currency: string }) {
  const largest = Math.max(...buckets.map((bucket) => bucket.amount), 0);

  return (
    <ul className="flex flex-col gap-3">
      {buckets.map((bucket) => {
        const width = largest > 0 ? (bucket.amount / largest) * 100 : 0;
        return (
          <li
            key={bucket.label}
            tabIndex={0}
            className="group relative grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent/60 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto]"
          >
            <span className="text-sm text-fg-muted">{bucket.label}</span>
            <div className="flex h-8 items-center border-l border-border">
              {bucket.amount > 0 && (
                <span
                  aria-hidden
                  className="h-5 rounded-r-[4px] bg-accent transition-opacity duration-hover group-hover:opacity-85"
                  style={{ width: `${Math.max(width, 1)}%` }}
                />
              )}
            </div>
            <span className={bucket.amount > 0 ? "text-sm text-fg tabular-nums" : "text-sm text-fg-muted tabular-nums"}>
              {formatCurrency(bucket.amount, currency)}
              <span className="sr-only">, soit {percent(bucket.share)} du montant en retard</span>
            </span>
            <span
              aria-hidden
              className="pointer-events-none absolute -top-8 left-28 z-10 rounded-md border border-border bg-elevated px-2.5 py-1 text-xs whitespace-nowrap text-fg opacity-0 shadow-raised transition-opacity duration-hover group-hover:opacity-100 group-focus-visible:opacity-100 sm:left-[9.25rem]"
            >
              {percent(bucket.share)} du montant en retard
            </span>
          </li>
        );
      })}
    </ul>
  );
}
