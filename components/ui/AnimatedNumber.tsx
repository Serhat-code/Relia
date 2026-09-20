"use client";

import { animate } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { EASE_STANDARD, MAX_UI_DURATION } from "@/lib/design/motion";
import { formatCurrency, formatDays, formatNumber } from "@/lib/format";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";

export type NumberFormat = "currency" | "number" | "days";

const PLAIN_FORMATTERS: Record<Exclude<NumberFormat, "currency">, (value: number) => string> = {
  number: formatNumber,
  days: formatDays,
};

const subscribeNever = () => () => undefined;

/** Faux pendant l'hydratation (la valeur rendue par le serveur est déjà affichée), vrai ensuite. */
function useIsClientMount(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

type AnimatedNumberProps = {
  value: number;
  format: NumberFormat;
  /** Devise ISO 4217 pour `format="currency"` : celle de l'organisation, pas l'euro par défaut. */
  currency?: string;
  className?: string;
};

/**
 * Compteur animé (≤ 400 ms). Les lecteurs d'écran lisent la valeur finale, jamais les
 * valeurs intermédiaires. Au rendu serveur, la vraie valeur s'affiche d'emblée : le
 * comptage depuis 0 n'a lieu que pour un montage côté client (navigation).
 */
export function AnimatedNumber({ value, format, currency = "EUR", className }: AnimatedNumberProps) {
  const formatValue = useCallback(
    (amount: number) => (format === "currency" ? formatCurrency(amount, currency) : PLAIN_FORMATTERS[format](amount)),
    [format, currency],
  );
  const isClientMount = useIsClientMount();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [initialValue] = useState(() => (isClientMount && !prefersReducedMotion ? 0 : value));
  const shownValue = useRef(initialValue);
  const counterRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const counter = counterRef.current;
    if (!counter) return;
    const from = shownValue.current;
    const show = (current: number) => {
      shownValue.current = current;
      counter.textContent = formatValue(current);
    };

    if (prefersReducedMotion || from === value) {
      show(value);
      return;
    }
    const controls = animate(from, value, { duration: MAX_UI_DURATION, ease: EASE_STANDARD, onUpdate: show });
    return () => controls.stop();
  }, [value, formatValue, prefersReducedMotion]);

  return (
    <span className={cn("tabular-nums", className)}>
      <span className="sr-only">{formatValue(value)}</span>
      {/* Texte initial figé : ensuite, seul l'effet écrit dans ce nœud. */}
      <span aria-hidden data-counter ref={counterRef}>
        {formatValue(initialValue)}
      </span>
    </span>
  );
}
