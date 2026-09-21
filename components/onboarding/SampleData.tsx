"use client";

import { FlaskConical, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { clearSampleDataAction, loadSampleDataAction } from "@/app/app/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
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

/**
 * Carte du jeu d'essai sur l'écran d'import : c'est là qu'on vient quand on cherche des données,
 * et elle reste accessible même avec de vraies factures — éprouver la boucle d'envoi et de réponse
 * demande un destinataire qu'on maîtrise, ce qu'un vrai client n'est jamais.
 */
export function SampleDataCard({ canManage, isLoaded }: { canManage: boolean; isLoaded: boolean }) {
  const { isPending, trigger } = useSampleAction(isLoaded ? clearSampleDataAction : loadSampleDataAction);

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 max-w-xl flex-col gap-1">
          <h2 className="flex items-center gap-2 font-medium">
            <FlaskConical aria-hidden className="size-4 shrink-0 text-link" />
            Jeu d&apos;essai
          </h2>
          <p className="text-sm text-fg-muted">
            {isLoaded
              ? "Cinq factures fictives et un client à votre adresse sont chargés. Effacez-les quand vous voulez : vos vraies données ne sont pas touchées."
              : "Cinq factures fictives et un client portant votre propre adresse. La relance vous revient, vous pouvez y répondre : la boucle complète s'éprouve sans impliquer un vrai client."}
          </p>
        </div>
        {canManage && (
          <Button
            variant={isLoaded ? "ghost" : "secondary"}
            icon={isLoaded ? <Trash2 aria-hidden /> : <FlaskConical aria-hidden />}
            status={isPending ? "loading" : "idle"}
            loadingLabel={isLoaded ? "Effacement…" : "Chargement…"}
            onClick={trigger}
          >
            {isLoaded ? "Effacer le jeu d'essai" : "Charger un jeu d'essai"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
