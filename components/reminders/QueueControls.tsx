"use client";

import { CalendarClock } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { planNowAction, setAutoSendAction } from "@/app/app/relances/actions";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast/ToastProvider";

/** Préparer les relances du jour sans attendre le passage du matin. */
export function PlanNowButton() {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <Button
      variant="secondary"
      icon={<CalendarClock aria-hidden />}
      status={isPending ? "loading" : "idle"}
      loadingLabel="Préparation…"
      onClick={() =>
        startTransition(async () => {
          const result = await planNowAction();
          toast.show(result.ok ? { tone: "success", title: result.message } : { tone: "error", title: result.error });
        })
      }
    >
      Préparer les relances du jour
    </Button>
  );
}

type AutoSendToggleProps = { isEnabled: boolean; canManage: boolean };

/**
 * Envoi automatique (§2.3) : les relances préparées partent sans validation, sauf la première
 * relance rédigée par IA pour chaque client, qui reste toujours soumise à votre validation.
 */
export function AutoSendToggle({ isEnabled, canManage }: AutoSendToggleProps) {
  const [value, setValue] = useState(isEnabled);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const descriptionId = useId();

  const toggle = () => {
    const next = !value;
    setValue(next);
    startTransition(async () => {
      const result = await setAutoSendAction({ isEnabled: next });
      if (result.ok) toast.show({ tone: "success", title: result.message });
      else {
        setValue(!next);
        toast.show({ tone: "error", title: result.error });
      }
    });
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/40 p-4">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-describedby={descriptionId}
        disabled={!canManage || isPending}
        onClick={toggle}
        className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-surface transition duration-hover aria-checked:border-accent aria-checked:bg-accent disabled:opacity-50"
      >
        <span className="sr-only">Envoi automatique</span>
        <span
          aria-hidden
          className={`inline-block size-4 rounded-full bg-fg shadow-raised transition-transform duration-hover ${value ? "translate-x-6" : "translate-x-1"}`}
        />
      </button>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Envoi automatique</span>
        <p id={descriptionId} className="text-xs text-fg-muted">
          Les relances préparées partent à l&apos;heure prévue, sans validation. La première relance rédigée par IA pour chaque
          client attend toujours votre validation.
          {!canManage && " Réglage réservé au propriétaire et aux administrateurs."}
        </p>
      </div>
    </div>
  );
}
