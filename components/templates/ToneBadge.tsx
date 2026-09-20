import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { REMINDER_TONE_LABELS, type ReminderTone } from "@/lib/templates/system-templates";

const TONE_BADGES: Readonly<Record<ReminderTone, BadgeTone>> = {
  courtois: "accent",
  ferme: "warning",
  mise_en_demeure: "danger",
};

export function ToneBadge({ tone }: { tone: ReminderTone }) {
  return <Badge tone={TONE_BADGES[tone]}>{REMINDER_TONE_LABELS[tone]}</Badge>;
}
