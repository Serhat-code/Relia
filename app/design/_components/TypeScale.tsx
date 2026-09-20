import { formatCurrency } from "@/lib/format";
import { Section } from "./Section";

const TYPE_SCALE = [
  { px: 56, className: "text-3xl font-display font-semibold", sample: `${formatCurrency(12480)} encaissés` },
  { px: 40, className: "text-2xl font-display font-semibold", sample: "Tableau de bord" },
  { px: 28, className: "text-xl font-display font-semibold", sample: "Factures en retard" },
  { px: 20, className: "text-lg font-medium", sample: "Relance programmée pour demain" },
  { px: 16, className: "text-base", sample: "Votre client a promis un règlement le 30 septembre." },
  { px: 14, className: "text-sm", sample: "Échéance dépassée de 12 jours" },
  { px: 12, className: "text-xs", sample: "Message assisté par IA" },
] as const;

const PROPORTIONAL_VS_TABULAR = [1111.11, 48230, 780.5, 12480, 9.99] as const;

export function TypeScale() {
  return (
    <Section
      title="Typographie"
      description="Inter pour l'interface, Space Grotesk pour les titres et les chiffres marquants. Échelle fermée : 12 / 14 / 16 / 20 / 28 / 40 / 56."
    >
      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-elevated">
        {TYPE_SCALE.map((step) => (
          <div key={step.px} className="flex flex-col gap-2 px-6 py-5 sm:flex-row sm:items-baseline sm:gap-8">
            <span className="w-16 shrink-0 font-mono text-xs text-fg-muted tabular-nums">{step.px} px</span>
            <p className={step.className} data-numeric>
              {step.sample}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FigureColumn title="Chiffres proportionnels — à proscrire" numeric="proportional" />
        <FigureColumn title="Chiffres tabulaires — obligatoires" numeric="tabular" />
      </div>
    </Section>
  );
}

function FigureColumn({ title, numeric }: { title: string; numeric: "proportional" | "tabular" }) {
  return (
    <div className="rounded-2xl border border-border bg-elevated p-6">
      <p className="mb-4 text-sm text-fg-muted">{title}</p>
      <table className={numeric === "proportional" ? "w-full proportional-nums" : "w-full"}>
        <tbody>
          {PROPORTIONAL_VS_TABULAR.map((amount) => (
            <tr key={amount}>
              <td className="py-1 text-right text-base">{formatCurrency(amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
