"use client";

import { CircleAlert, Info, X } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, type Transition } from "motion/react";
import { ReliaLoader } from "@/components/brand/ReliaLoader";
import { DURATION } from "@/lib/design/motion";
import type { Toast, ToastTone } from "./toast-store";

/** Entrée par la droite avec un léger rebond (CLAUDE.md §6). */
const ENTER: Transition = { type: "spring", visualDuration: DURATION.enter, bounce: 0.3 };
const EXIT: Transition = { duration: DURATION.hover, ease: "easeIn" };

/** Chargement et succès partagent le même loader : il se referme en anneau quand la tâche aboutit. */
function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "loading" || tone === "success") {
    return <ReliaLoader size="sm" state={tone === "loading" ? "loading" : "success"} isDecorative />;
  }
  if (tone === "error") return <CircleAlert aria-hidden className="size-4 text-danger" />;
  return <Info aria-hidden className="size-4 text-link" />;
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-elevated p-4 shadow-raised">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
        <ToastIcon tone={toast.tone} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-sm text-fg-muted">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer la notification"
        className="-m-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted transition duration-hover hover:bg-surface hover:text-fg"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}

type ToastViewportProps = {
  toasts: readonly Toast[];
  onDismiss: (id: string) => void;
  onPauseChange: (isPaused: boolean) => void;
};

export function ToastViewport({ toasts, onDismiss, onPauseChange }: ToastViewportProps) {
  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 bottom-4 z-50 w-[min(24rem,calc(100vw-2rem))]"
        onMouseEnter={() => onPauseChange(true)}
        onMouseLeave={() => onPauseChange(false)}
        onFocus={() => onPauseChange(true)}
        onBlur={() => onPauseChange(false)}
      >
        {/* Les annonces passent par ToastAnnouncer : pas de zone live imbriquée ici. */}
        <ol className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {toasts.map((toast) => (
              <motion.li
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 48 }}
                animate={{ opacity: 1, x: 0, transition: ENTER }}
                exit={{ opacity: 0, x: 24, transition: EXIT }}
                className="pointer-events-auto"
              >
                <ToastCard toast={toast} onDismiss={() => onDismiss(toast.id)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </section>
    </MotionConfig>
  );
}
