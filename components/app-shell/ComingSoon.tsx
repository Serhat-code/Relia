import { ReliaMark } from "@/components/brand/ReliaMark";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/motion/Reveal";

/** Section pas encore construite : indique le palier qui l'apportera (CLAUDE.md §10). */
export function ComingSoon({ description }: { description: string }) {
  return (
    <Reveal index={1}>
      <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <ReliaMark size={40} isDecorative />
        <p className="max-w-md text-sm text-fg-muted">{description}</p>
      </Card>
    </Reveal>
  );
}
