import { formatCurrency, formatDate } from "@/lib/format";
import type { Theme } from "@/lib/design/theme";
import { Section } from "./Section";

const PREVIEWS: ReadonlyArray<{ theme: Theme; label: string }> = [
  { theme: "dark", label: "Sombre — par défaut" },
  { theme: "light", label: "Clair — comptabilité" },
];

const STATUSES = [
  { label: "En retard", className: "bg-danger/12 text-danger" },
  { label: "Promesse", className: "bg-warning/12 text-warning" },
  { label: "Payée", className: "bg-success/12 text-success" },
] as const;

export function ThemePreview() {
  return (
    <Section
      title="Thèmes côte à côte"
      description="Chaque aperçu force son thème avec data-theme : les jetons se résolvent localement, indépendamment du thème de la page."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {PREVIEWS.map((preview) => (
          <div
            key={preview.theme}
            data-theme={preview.theme}
            className="flex flex-col gap-5 rounded-2xl border border-border bg-canvas p-6 text-fg"
          >
            <p className="text-xs font-medium tracking-[0.2em] text-fg-muted uppercase">{preview.label}</p>

            <div className="rounded-xl border border-border bg-elevated p-5 shadow-raised">
              <p className="text-sm text-fg-muted">Encours total</p>
              <p className="mt-1 font-display text-xl font-semibold" data-numeric>
                {formatCurrency(48230)}
              </p>
              <p className="mt-3 text-sm text-fg-muted">
                dont <span className="font-medium text-danger" data-numeric>{formatCurrency(12480)}</span> en retard
                depuis le <time dateTime="2026-08-31">{formatDate("2026-08-31T12:00:00Z")}</time>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUSES.map((status) => (
                <span key={status.label} className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                  {status.label}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg">
                Programmer la relance
              </span>
              <span className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-fg">
                Prévisualiser
              </span>
              <span className="text-xs text-fg-muted">Message assisté par IA</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
