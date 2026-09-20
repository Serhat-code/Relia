import type { ReactNode } from "react";
import { ReliaMark } from "@/components/brand/ReliaMark";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  /** Sans carte : à l'intérieur d'une carte ou d'un tableau existant. */
  isBare?: boolean;
  className?: string;
};

/** Rien à afficher encore : dire pourquoi, et proposer la prochaine action. */
export function EmptyState({ title, description, actions, isBare = false, className }: EmptyStateProps) {
  const content = (
    <div className={cn("flex flex-col items-center gap-4 px-6 py-14 text-center", isBare && className)}>
      <ReliaMark size={40} isDecorative />
      <div className="flex max-w-md flex-col gap-1.5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-fg-muted">{description}</p>
      </div>
      {actions && <div className="mt-2 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );

  return isBare ? content : <Card className={className}>{content}</Card>;
}
