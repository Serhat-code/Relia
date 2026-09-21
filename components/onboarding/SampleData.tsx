"use client";

import { FlaskConical, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { clearSampleDataAction, loadSampleDataAction } from "@/app/app/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { useToast } from "@/components/ui/toast/ToastProvider";

/**
 * Jeu d'essai : de quoi voir Relia travailler avant d'avoir préparé un CSV. Le client fictif porte
 * l'adresse du membre, donc la relance lui revient et il peut y répondre.
 */

function useSampleAction(run: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
  const [isPending, start] = useTransition();
  const toast = useToast();
  const trigger = () =>
    start(async () => {
      const result = await run();
      toast.show({
        tone: result.ok ? "success" : "error",
        title: result.ok ? (result.message ?? "C'est fait.") : (result.error ?? "Action impossible."),
      });
    });
  return { isPending, trigger };
}

export function LoadSampleDataButton() {
  const { isPending, trigger } = useSampleAction(loadSampleDataAction);

  return (
    <Button
      variant="secondary"
      icon={<FlaskConical aria-hidden />}
      status={isPending ? "loading" : "idle"}
      loadingLabel="Chargement…"
      onClick={trigger}
    >
      Charger un jeu d&apos;essai
    </Button>
  );
}

/** Rappel permanent tant que des données fictives cohabitent avec les vraies. */
export function SampleDataBanner() {
  const { isPending, trigger } = useSampleAction(clearSampleDataAction);

  return (
    <FormMessage tone="info">
      <span className="flex flex-wrap items-center justify-between gap-3">
        <span>
          Un <strong className="font-semibold">jeu d&apos;essai</strong> est chargé : cinq factures fictives et un client
          à votre propre adresse. Les relances vous reviendront.
        </span>
        <Button
          variant="ghost"
          icon={<Trash2 aria-hidden />}
          status={isPending ? "loading" : "idle"}
          loadingLabel="Effacement…"
          onClick={trigger}
        >
          Effacer
        </Button>
      </span>
    </FormMessage>
  );
}
