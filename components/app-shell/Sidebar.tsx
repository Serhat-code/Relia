"use client";

import {
  FileStack,
  FileText,
  LayoutDashboard,
  Mail,
  MessageSquareReply,
  ScrollText,
  Send,
  Settings,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { DURATION } from "@/lib/design/motion";

type NavItem = { label: string; href: string; icon: LucideIcon };

/** Sections de l'application (CLAUDE.md §7). */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Tableau de bord", href: "/app", icon: LayoutDashboard },
  { label: "Factures", href: "/app/factures", icon: FileText },
  { label: "Relances", href: "/app/relances", icon: Send },
  { label: "Réponses", href: "/app/reponses", icon: MessageSquareReply },
  { label: "Débiteurs", href: "/app/debiteurs", icon: Users },
  { label: "Scénarios", href: "/app/scenarios", icon: Workflow },
  { label: "Modèles", href: "/app/modeles", icon: FileStack },
  { label: "Boîte d'envoi", href: "/app/boite-mail", icon: Mail },
  { label: "Journal", href: "/app/journal", icon: ScrollText },
  { label: "Paramètres", href: "/app/parametres", icon: Settings },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Navigation principale : l'indicateur actif glisse d'un élément à l'autre (layoutId). */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
      <nav aria-label="Navigation principale">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = isActivePath(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-hover",
                    isActive ? "text-fg" : "text-fg-muted hover:bg-surface/60 hover:text-fg",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active-item"
                      aria-hidden
                      className="absolute inset-0 rounded-lg border border-glow bg-accent-soft"
                      transition={{ type: "spring", visualDuration: DURATION.enter, bounce: 0.15 }}
                    />
                  )}
                  <Icon aria-hidden className={cn("relative size-4", isActive && "text-link")} />
                  <span className="relative">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </MotionConfig>
  );
}
