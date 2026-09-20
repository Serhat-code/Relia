import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AnimatedNumber, type NumberFormat } from "./AnimatedNumber";
import { Card } from "./Card";

type StatTone = "neutral" | "success" | "danger";

const TONES: Record<StatTone, string> = {
  neutral: "text-fg",
  success: "text-success",
  danger: "text-danger",
};

type StatCardProps = {
  label: string;
  /** Null : valeur non calculable (affichée « — », dite « non disponible »). */
  value: number | null;
  format: NumberFormat;
  /** Devise ISO 4217 pour `format="currency"`. */
  currency?: string;
  tone?: StatTone;
  icon?: ReactNode;
  hint?: ReactNode;
  className?: string;
};

/** Carte de statistique : compteur animé au montage, léger dégradé qui dérive en fond (CLAUDE.md §6). */
export function StatCard({ label, value, format, currency, tone = "neutral", icon, hint, className }: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden p-6", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-stat-drift bg-stat-glow motion-reduce:animate-none"
      />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 text-sm text-fg-muted [&_svg]:size-4">
          <span>{label}</span>
          {icon}
        </div>
        {value === null ? (
          <span className="font-display text-xl font-semibold text-fg-muted">
            <span aria-hidden>—</span>
            <span className="sr-only">Non disponible</span>
          </span>
        ) : (
          <AnimatedNumber
            value={value}
            format={format}
            currency={currency}
            className={cn("font-display text-xl font-semibold", TONES[tone])}
          />
        )}
        {hint && <div className="text-xs text-fg-muted">{hint}</div>}
      </div>
    </Card>
  );
}
