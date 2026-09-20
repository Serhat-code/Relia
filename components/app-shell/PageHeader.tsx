import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

/** En-tête de page : premier bloc de la cascade d'apparition. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Reveal index={0} className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </Reveal>
  );
}
