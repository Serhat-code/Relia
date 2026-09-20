import { markdownBlocks } from "@/lib/templates/markdown";

type MessagePreviewProps = { from: string; subject: string; bodyMarkdown: string };

/** Aperçu d'une relance telle que le client la recevra, envoyée depuis la boîte de l'expéditeur. */
export function MessagePreview({ from, subject, bodyMarkdown }: MessagePreviewProps) {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-canvas" aria-label="Aperçu du message">
      <header className="flex flex-col gap-1 border-b border-border bg-surface/50 px-5 py-3 text-sm">
        <p className="text-fg-muted">
          De : <span className="text-fg">{from}</span>
        </p>
        <p className="font-medium text-fg">{subject || "(sans objet)"}</p>
      </header>
      <div className="flex flex-col gap-3 px-5 py-4 text-sm leading-relaxed text-fg">
        {markdownBlocks(bodyMarkdown).map((paragraph, paragraphIndex) => (
          <p key={paragraphIndex}>
            {paragraph.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 && <br />}
                {line.map((run, runIndex) =>
                  run.isBold ? <strong key={runIndex}>{run.text}</strong> : <span key={runIndex}>{run.text}</span>,
                )}
              </span>
            ))}
          </p>
        ))}
      </div>
    </article>
  );
}
