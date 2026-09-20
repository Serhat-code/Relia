import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/marketing/SiteChrome";

/** Pages légales et de conformité : même cadre que le site public, colonne de lecture étroite. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-12 pb-24 sm:px-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
