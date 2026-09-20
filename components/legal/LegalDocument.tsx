import type { ReactNode } from "react";
import { FormMessage } from "@/components/ui/FormMessage";
import type { LegalSection } from "@/lib/legal/dpa";

type LegalDocumentProps = {
  eyebrow: string;
  title: string;
  version?: string;
  intro?: ReactNode;
  /** Texte encore soumis à validation juridique : un bandeau le signale. */
  isDraft?: boolean;
  sections: readonly LegalSection[];
  children?: ReactNode;
};

/** Document juridique versionné : titre, version, sections numérotées. */
export function LegalDocument({ eyebrow, title, version, intro, isDraft = false, sections, children }: LegalDocumentProps) {
  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-[0.2em] text-fg-muted uppercase">{eyebrow}</p>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {version && (
          <p className="text-sm text-fg-muted">
            Version <data value={version}>{version}</data>.{intro && <> {intro}</>}
          </p>
        )}
        {!version && intro && <p className="text-sm text-fg-muted">{intro}</p>}
        {isDraft && (
          <FormMessage tone="info">Texte en cours de validation juridique : il sera finalisé avant l&apos;ouverture du service.</FormMessage>
        )}
      </header>

      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-base leading-relaxed text-fg-muted">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      {children}
    </article>
  );
}
