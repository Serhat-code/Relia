import { ReliaMark } from "@/components/brand/ReliaMark";
import { RING_STAGE_LABELS, RING_STAGES } from "@/lib/brand/ring";
import { Section } from "../../_components/Section";

export function MarkGallery() {
  return (
    <Section
      title="Logo et étapes"
      description="Un arc par étape du cycle, dans le sens horaire depuis midi. Une étape mise en avant est le seul arc plein : « payé » allume l'encaissement."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-border bg-elevated p-8">
          <ReliaMark size={96} />
          <div className="flex items-center gap-2.5">
            <ReliaMark size={28} isDecorative />
            <span className="font-display text-xl font-semibold">Relia</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {RING_STAGES.map((stage) => (
            <div
              key={stage}
              className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-elevated p-6"
            >
              <ReliaMark size={56} stage={stage} />
              <p className="text-center text-sm text-fg-muted">{RING_STAGE_LABELS[stage]}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
