import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/marketing/SiteChrome";

/** Pages publiques : accueil et tarifs (le halo de fond vient du gabarit racine). */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
