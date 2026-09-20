import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type FormMessageTone = "error" | "success" | "info";

const TONES: Record<FormMessageTone, { className: string; icon: ReactNode }> = {
  error: {
    className: "border-danger/30 bg-danger/8",
    icon: <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />,
  },
  success: {
    className: "border-success/30 bg-success/8",
    icon: <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />,
  },
  info: {
    className: "border-accent/30 bg-accent/8",
    icon: <Info aria-hidden className="size-4 shrink-0 text-link" />,
  },
};

/** Message global d'un formulaire : une erreur est annoncée immédiatement (alert), le reste poliment (status). */
export function FormMessage({ tone, children }: { tone: FormMessageTone; children: ReactNode }) {
  const { className, icon } = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm text-fg", className)}
    >
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
