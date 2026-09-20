import Link from "next/link";
import type { AuditEntry } from "@/lib/data/audit";
import { formatDateTime } from "@/lib/format";

/** Historique vertical : l'action, qui l'a faite, quand. */
export function AuditTimeline({ entries, emptyText = "Aucun événement pour l'instant." }: { entries: readonly AuditEntry[]; emptyText?: string }) {
  if (entries.length === 0) {
    return <p className="text-sm text-fg-muted">{emptyText}</p>;
  }

  return (
    <ol className="relative flex flex-col gap-5 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-border">
      {entries.map((entry) => (
        <li key={entry.id} className="relative flex gap-4 pl-6">
          <span
            aria-hidden
            className="absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-elevated bg-accent shadow-[0_0_0_1px_var(--border)]"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm text-fg">{entry.description}</p>
            <p className="text-xs text-fg-muted">
              {entry.actor} · <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
              {entry.link && (
                <>
                  {" · "}
                  <Link href={entry.link.href} className="font-medium text-link hover:underline">
                    {entry.link.label}
                  </Link>
                </>
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
