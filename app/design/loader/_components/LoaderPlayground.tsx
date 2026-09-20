"use client";

import { useState } from "react";
import { ReliaLoader, type ReliaLoaderSize, type ReliaLoaderState } from "@/components/brand/ReliaLoader";
import { Section } from "../../_components/Section";
import { useSimulatedTask } from "../../_components/use-simulated-task";

const SEQUENCE_MS = 2400;

const SIZES: ReadonlyArray<{ size: ReliaLoaderSize; px: number; usage: string }> = [
  { size: "sm", px: 16, usage: "Boutons" },
  { size: "md", px: 32, usage: "Imports, synchronisations" },
  { size: "lg", px: 64, usage: "Chargement de page" },
];

const STATES: ReadonlyArray<{ value: ReliaLoaderState; label: string }> = [
  { value: "loading", label: "Chargement" },
  { value: "success", label: "Succès" },
];

const CONTROL_BUTTON =
  "h-9 rounded-lg px-3 text-sm font-medium transition duration-hover active:scale-[0.97]";

export function LoaderPlayground() {
  const task = useSimulatedTask({ durationMs: SEQUENCE_MS, initialPhase: "loading" });
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [hasFaviconAnimation, setHasFaviconAnimation] = useState(false);
  const state: ReliaLoaderState = task.phase === "success" ? "success" : "loading";

  return (
    <>
      <Section
        title="Signature"
        description="Quatre arcs, quatre vitesses, sens alternés ; le dégradé glisse le long des arcs. Au succès, les arcs convergent, l'anneau se ferme, puis une onde se diffuse."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="relative flex min-h-96 items-center justify-center overflow-hidden rounded-2xl border border-border bg-elevated">
            <div style={{ zoom: 3 }}>
              <ReliaLoader
                size="lg"
                state={state}
                isReducedMotion={isReducedMotion}
                hasFaviconAnimation={hasFaviconAnimation}
              />
            </div>
            <p className="absolute bottom-4 left-5 text-xs text-fg-muted">Loupe ×3 · taille lg</p>
          </div>

          <div className="flex flex-col gap-6 rounded-2xl border border-border bg-elevated p-6">
            <button
              type="button"
              onClick={task.start}
              className={`${CONTROL_BUTTON} bg-accent text-accent-fg hover:bg-accent-hover hover:shadow-halo`}
            >
              Lancer une séquence
            </button>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-xs font-medium text-fg-muted">État</legend>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1">
                {STATES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={state === option.value}
                    onClick={() => task.set(option.value)}
                    className={`${CONTROL_BUTTON} h-8 text-fg-muted aria-pressed:bg-elevated aria-pressed:text-fg aria-pressed:shadow-raised`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-3 text-sm">
              <Toggle checked={isReducedMotion} onChange={setIsReducedMotion} label="Mouvement réduit" />
              <Toggle
                checked={hasFaviconAnimation}
                onChange={setHasFaviconAnimation}
                label="Favicon animé (regardez l'onglet)"
              />
            </div>

            <p className="mt-auto text-xs text-fg-muted">
              Convergence 600 ms · fermeture 360 ms · surimpulsion 1 → 1,08 → 1 · onde 720 ms.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Tailles" description="La même séquence, aux trois tailles du composant.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SIZES.map(({ size, px, usage }) => (
            <div key={size} className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-elevated p-8">
              <div className="flex size-16 items-center justify-center">
                <ReliaLoader size={size} state={state} isReducedMotion={isReducedMotion} isDecorative />
              </div>
              <p className="text-center text-sm">
                <span className="font-mono text-fg">{size}</span>
                <span className="text-fg-muted"> · {px} px — {usage}</span>
              </p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

type ToggleProps = { checked: boolean; onChange: (checked: boolean) => void; label: string };

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-accent"
      />
      <span>{label}</span>
    </label>
  );
}
