import type { ReactNode } from "react";

type SectionProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function Section({ title, description, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="max-w-2xl text-sm text-fg-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}
