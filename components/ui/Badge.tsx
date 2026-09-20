import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

/**
 * Pastille colorée + libellé en couleur de texte : le libellé reste lisible (contraste AA)
 * sur fond teinté, la couleur porte le sens sans être le seul indice.
 */
const TONES: Record<BadgeTone, { badge: string; dot: string }> = {
  neutral: { badge: "border-border bg-surface", dot: "text-fg-muted" },
  accent: { badge: "border-accent/25 bg-accent/10", dot: "text-accent" },
  success: { badge: "border-success/25 bg-success/10", dot: "text-success" },
  warning: { badge: "border-warning/25 bg-warning/10", dot: "text-warning" },
  danger: { badge: "border-danger/25 bg-danger/10", dot: "text-danger" },
};

type BadgeProps = {
  tone?: BadgeTone;
  /** Pulsation douce de la pastille, pour un état qui appelle l'attention (« en retard »). */
  hasPulse?: boolean;
  className?: string;
  children: ReactNode;
};

export function Badge({ tone = "neutral", hasPulse = false, className, children }: BadgeProps) {
  const { badge, dot } = TONES[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-fg",
        badge,
        className,
      )}
    >
      <span aria-hidden data-dot className={cn("relative flex size-1.5", dot)}>
        {hasPulse && (
          <span
            data-pulse
            className="absolute inset-0 animate-status-pulse rounded-full bg-current motion-reduce:hidden"
          />
        )}
        <span className="relative size-1.5 rounded-full bg-current" />
      </span>
      {children}
    </span>
  );
}
