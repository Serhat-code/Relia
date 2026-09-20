import { ChevronDown } from "lucide-react";

export type FaqItem = { question: string; answer: string };

/** Questions fréquentes : éléments natifs <details>, accessibles et utilisables sans JavaScript. */
export function Faq({ items }: { items: readonly FaqItem[] }) {
  return (
    <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-elevated">
      {items.map((item) => (
        <details key={item.question} className="group px-5 py-4 open:pb-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-fg [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown aria-hidden className="size-4 shrink-0 text-fg-muted transition-transform duration-hover group-open:rotate-180" />
          </summary>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-fg-muted">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
