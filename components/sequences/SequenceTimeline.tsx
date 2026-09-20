import { cn } from "@/lib/cn";
import { describeOffset, shortOffset } from "@/lib/sequences/steps";
import { REMINDER_TONE_LABELS, type ReminderTone } from "@/lib/templates/system-templates";

const TONE_DOTS: Readonly<Record<ReminderTone, string>> = {
  courtois: "bg-accent",
  ferme: "bg-warning",
  mise_en_demeure: "bg-danger",
};

type TimelineStep = { key: string; offsetDays: number; tone: ReminderTone };

/** Frise des étapes autour de l'échéance (J) : on voit d'un coup d'œil le rythme des relances. */
export function SequenceTimeline({ steps }: { steps: readonly TimelineStep[] }) {
  const offsets = steps.map((step) => step.offsetDays);
  const start = Math.min(-7, ...offsets) - 3;
  const end = Math.max(14, ...offsets) + 3;
  const position = (offset: number) => `${((offset - start) / (end - start)) * 100}%`;

  return (
    <div className="px-3 pt-8 pb-10" role="img" aria-label={steps.map((step) => describeOffset(step.offsetDays)).join(", ")}>
      <div className="relative h-1 rounded-full bg-surface">
        <div
          className="absolute top-1/2 h-full -translate-y-1/2 rounded-full bg-gradient-brand opacity-40"
          style={{ left: position(0), right: 0 }}
        />
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: position(0) }}>
          <span className="block h-5 w-0.5 rounded-full bg-fg-muted" />
          <span className="absolute top-6 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap text-fg-muted">
            Échéance
          </span>
        </div>
        {steps.map((step, index) => (
          <div
            key={step.key}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: position(step.offsetDays) }}
            title={`${REMINDER_TONE_LABELS[step.tone]} — ${describeOffset(step.offsetDays)}`}
          >
            <span className={cn("block size-3 rounded-full ring-4 ring-elevated", TONE_DOTS[step.tone])} />
            <span
              className={cn(
                "absolute left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap text-fg tabular-nums",
                index % 2 === 0 ? "bottom-5" : "top-5",
              )}
            >
              {shortOffset(step.offsetDays)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
