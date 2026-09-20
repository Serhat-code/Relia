"use client";

import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { DURATION } from "@/lib/design/motion";
import { formatNumber } from "@/lib/format";

export type LinkTab = { label: string; href: string; count?: number; isActive: boolean };

/**
 * Onglets de filtre sous forme de liens (l'état vit dans l'URL) : l'indicateur actif glisse
 * d'un onglet à l'autre, comme dans la barre latérale.
 */
export function LinkTabs({ tabs, label }: { tabs: readonly LinkTab[]; label: string }) {
  const indicatorId = useId();

  return (
    <MotionConfig reducedMotion="user">
      <nav aria-label={label} className="-mx-1 overflow-x-auto px-1">
        <ul className="flex w-max gap-1 rounded-xl border border-border bg-surface/50 p-1">
          {tabs.map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                scroll={false}
                aria-current={tab.isActive ? "page" : undefined}
                className={cn(
                  "relative flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors duration-hover",
                  tab.isActive ? "text-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {tab.isActive && (
                  <motion.span
                    layoutId={indicatorId}
                    aria-hidden
                    className="absolute inset-0 rounded-lg border border-glow bg-elevated shadow-raised"
                    transition={{ type: "spring", visualDuration: DURATION.enter, bounce: 0.15 }}
                  />
                )}
                <span className="relative">{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "relative rounded-md px-1.5 text-xs tabular-nums",
                      tab.isActive ? "bg-accent-soft text-link" : "bg-surface text-fg-muted",
                    )}
                  >
                    {formatNumber(tab.count)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </MotionConfig>
  );
}
