import type { ComponentProps, CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { STAGGER_DELAY } from "@/lib/design/motion";

/** Au-delà, les lignes arrivent ensemble : une longue liste ne doit pas faire attendre. */
export const MAX_CASCADE_ROWS = 12;

type Align = "left" | "right" | "center";
const ALIGN: Record<Align, string> = { left: "text-left", right: "text-right", center: "text-center" };

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-separate border-spacing-0 text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader(props: ComponentProps<"thead">) {
  return <thead {...props} />;
}

export function TableBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

type TableRowProps = ComponentProps<"tr"> & {
  /** Position de la ligne : active l'apparition en cascade (40 ms par ligne). */
  index?: number;
};

export function TableRow({ index, className, style, ...props }: TableRowProps) {
  const cascade: CSSProperties | undefined =
    index === undefined
      ? undefined
      : { animationDelay: `${Math.round(Math.min(index, MAX_CASCADE_ROWS) * STAGGER_DELAY * 1000)}ms` };

  return (
    <tr
      className={cn("group", index !== undefined && "animate-row-in motion-reduce:animate-none", className)}
      style={{ ...cascade, ...style }}
      {...props}
    />
  );
}

type CellProps<T extends "th" | "td"> = ComponentProps<T> & { align?: Align };

export function TableHead({ align = "left", className, ...props }: CellProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-border px-4 py-3 text-xs font-medium tracking-wide whitespace-nowrap text-fg-muted uppercase",
        ALIGN[align],
        className,
      )}
      {...props}
    />
  );
}

/** Survol : la ligne s'illumine d'un halo de bordure (bordures des cellules, coins arrondis aux extrémités). */
export function TableCell({ align = "left", className, ...props }: CellProps<"td">) {
  return (
    <td
      className={cn(
        "border-y border-transparent px-4 py-3 shadow-[inset_0_-1px_0_var(--border)] transition-colors duration-hover",
        "first:border-l last:border-r",
        // Coins arrondis au survol seulement : au repos, le trait de séparation reste droit jusqu'aux bords.
        "group-hover:border-glow group-hover:bg-accent-soft group-hover:shadow-none",
        "group-hover:first:rounded-l-xl group-hover:last:rounded-r-xl",
        ALIGN[align],
        className,
      )}
      {...props}
    />
  );
}
