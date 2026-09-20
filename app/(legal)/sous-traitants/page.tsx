import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { SUBPROCESSORS } from "@/lib/legal/subprocessors";

export const metadata: Metadata = {
  title: "Sous-traitants",
  description: "Les prestataires sur lesquels s'appuie Relia, leur rôle et la localisation des données.",
};

export default function SubprocessorsPage() {
  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-[0.2em] text-fg-muted uppercase">RGPD</p>
        <h1 className="text-2xl font-semibold">Sous-traitants ultérieurs</h1>
        <p className="text-base leading-relaxed text-fg-muted">
          Pour fournir le service, Relia s&apos;appuie sur les prestataires ci-dessous. Les données sont hébergées et
          traitées dans l&apos;Union européenne. Tout ajout ou remplacement vous est annoncé au moins trente jours à
          l&apos;avance.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {SUBPROCESSORS.map((subprocessor) => (
          <li key={subprocessor.name}>
            <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold">{subprocessor.name}</h2>
                <p className="text-sm text-fg">{subprocessor.purpose}</p>
                <p className="text-sm text-fg-muted">Données : {subprocessor.dataProcessed}</p>
              </div>
              <p className="flex shrink-0 items-center gap-1.5 text-sm text-fg-muted sm:max-w-56 sm:text-right">
                <MapPin aria-hidden className="size-4 shrink-0 text-link" />
                {subprocessor.location}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </article>
  );
}
