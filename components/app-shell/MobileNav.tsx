"use client";

import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SidebarNav } from "./Sidebar";

/** Petits écrans : la navigation se déplie sous l'en-tête et se replie après un choix. */
export function MobileNav({ footer }: { footer: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="navigation-mobile"
        aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-elevated text-fg-muted transition duration-hover hover:text-fg"
      >
        {isOpen ? <X aria-hidden className="size-4" /> : <Menu aria-hidden className="size-4" />}
      </button>
      {isOpen && (
        <div
          id="navigation-mobile"
          className="absolute inset-x-0 top-full z-40 flex animate-page-in flex-col gap-6 border-b border-border bg-canvas p-4 shadow-raised"
        >
          <SidebarNav onNavigate={() => setIsOpen(false)} />
          {footer}
        </div>
      )}
    </>
  );
}
