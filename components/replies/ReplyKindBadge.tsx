import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { REPLY_KIND_LABELS, type ReplyKind } from "@/lib/replies/labels";

export function ReplyKindBadge({ kind }: { kind: ReplyKind }) {
  const { label, tone } = REPLY_KIND_LABELS[kind];
  return <Badge tone={tone}>{label}</Badge>;
}

/** Transparence (AI Act) : le classement de la réponse vient de l'IA, pas d'une règle ni d'un membre. */
export function AiAnalysisBadge() {
  return (
    <Badge tone="accent">
      <Sparkles aria-hidden className="size-3" />
      Analyse assistée par IA
    </Badge>
  );
}
