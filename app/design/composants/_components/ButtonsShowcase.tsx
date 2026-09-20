"use client";

import { RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/button-styles";
import { Section } from "../../_components/Section";
import { useSimulatedTask } from "../../_components/use-simulated-task";

const VARIANTS: ReadonlyArray<{ variant: ButtonVariant; label: string }> = [
  { variant: "primary", label: "Programmer la relance" },
  { variant: "secondary", label: "Prévisualiser" },
  { variant: "ghost", label: "Annuler" },
  { variant: "danger", label: "Supprimer le débiteur" },
];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <p className="w-32 shrink-0 text-xs font-medium text-fg-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function ButtonsShowcase() {
  const send = useSimulatedTask({ durationMs: 1600, resetAfterMs: 1400 });
  const sync = useSimulatedTask({ durationMs: 2200, resetAfterMs: 1400 });

  return (
    <Section
      title="Boutons"
      description="Halo qui s'intensifie au survol, enfoncement à 0,97 au clic, loader intégré pendant l'action : il se referme en anneau au succès."
    >
      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-elevated p-6">
        <Row label="Variantes">
          {VARIANTS.map(({ variant, label }) => (
            <Button key={variant} variant={variant}>
              {label}
            </Button>
          ))}
        </Row>
        <Row label="Tailles">
          <Button size="sm">Petit</Button>
          <Button>Moyen</Button>
          <Button size="lg">Grand</Button>
        </Row>
        <Row label="Pendant l'action">
          <Button icon={<Send />} status={send.phase} loadingLabel="Envoi…" onClick={send.start}>
            {send.phase === "success" ? "Relance envoyée" : "Envoyer la relance"}
          </Button>
          <Button variant="secondary" icon={<RefreshCw />} status={sync.phase} onClick={sync.start}>
            {sync.phase === "success" ? "Synchronisé" : "Synchroniser"}
          </Button>
        </Row>
        <Row label="Inactif, lien">
          <Button disabled>Inactif</Button>
          <Link href="/design" className={buttonClasses({ variant: "secondary" })}>
            Lien stylé en bouton
          </Link>
        </Row>
      </div>
    </Section>
  );
}
