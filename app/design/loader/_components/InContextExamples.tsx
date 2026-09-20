"use client";

import { ReliaLoader } from "@/components/brand/ReliaLoader";
import { Section } from "../../_components/Section";
import { useSimulatedTask } from "../../_components/use-simulated-task";

const SEND_LABELS = { idle: "Envoyer la relance", loading: "Envoi…", success: "Relance envoyée" } as const;
const IMPORT_LABELS = {
  idle: "Aucun import en cours",
  loading: "Import de 128 factures…",
  success: "128 factures importées",
} as const;

export function InContextExamples() {
  const send = useSimulatedTask({ durationMs: 1800, resetAfterMs: 1600 });
  const upload = useSimulatedTask({ durationMs: 2800 });

  return (
    <Section
      title="En situation"
      description="Spinner de bouton (sm, ton « current » sur fond plein) et import (md). Le loader reste monté entre chargement et succès pour que la transition se joue."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-elevated p-6">
          <p className="text-sm text-fg-muted">Bouton d&apos;action</p>
          <button
            type="button"
            onClick={send.start}
            disabled={send.phase !== "idle"}
            aria-busy={send.phase === "loading"}
            className="inline-flex h-10 items-center gap-2.5 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition duration-hover hover:bg-accent-hover hover:shadow-halo active:scale-[0.97] disabled:cursor-default"
          >
            {send.phase !== "idle" && <ReliaLoader size="sm" state={send.phase} tone="current" isDecorative />}
            {SEND_LABELS[send.phase]}
          </button>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-elevated p-6">
          <p className="text-sm text-fg-muted">Import de factures</p>
          <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
            <div className="flex size-8 items-center justify-center">
              {upload.phase !== "idle" && (
                <ReliaLoader
                  size="md"
                  state={upload.phase}
                  label={upload.phase === "loading" ? "Import en cours" : "Import terminé"}
                />
              )}
            </div>
            <p className="text-sm">{IMPORT_LABELS[upload.phase]}</p>
          </div>
          <button
            type="button"
            onClick={upload.start}
            className="h-9 w-fit rounded-lg border border-border bg-surface px-3 text-sm font-medium transition duration-hover hover:border-glow active:scale-[0.97]"
          >
            Importer le fichier
          </button>
        </div>
      </div>
    </Section>
  );
}
