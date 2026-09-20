import { Section } from "./Section";

const DURATIONS = [
  { ms: 220, className: "duration-hover", usage: "Survol, pression" },
  { ms: 280, className: "duration-enter", usage: "Apparitions, toasts" },
  { ms: 320, className: "duration-page", usage: "Transitions de page" },
] as const;

export function MotionTokens() {
  return (
    <Section
      title="Mouvement"
      description="Courbe standard cubic-bezier(0.22, 1, 0.36, 1), durées de 220 à 320 ms. Rien au-delà de 400 ms, sauf le loader. Survolez les pistes."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-elevated p-6">
          <svg viewBox="-4 -4 108 108" className="aspect-square w-full" aria-hidden>
            <rect x="0" y="0" width="100" height="100" fill="none" stroke="var(--border)" />
            <path d="M0 100 C22 0 36 0 100 0" fill="none" stroke="var(--accent)" strokeWidth="2" />
          </svg>
          <code className="font-mono text-xs text-fg-muted">ease-standard</code>
        </div>

        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-elevated">
          {DURATIONS.map((duration) => (
            <div key={duration.ms} className="group flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:gap-8">
              <div className="flex w-40 shrink-0 flex-col">
                <span className="font-mono text-xs text-fg tabular-nums">{duration.ms} ms</span>
                <span className="text-xs text-fg-muted">{duration.usage}</span>
              </div>
              <div className="relative h-4 w-48 rounded-full bg-surface">
                <span
                  className={`absolute top-0 left-0 size-4 rounded-full bg-gradient-brand shadow-halo transition-transform ease-standard group-hover:translate-x-44 motion-reduce:transition-none ${duration.className}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
