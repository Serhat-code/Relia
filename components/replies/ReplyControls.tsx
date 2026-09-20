"use client";

import { HandCoins, Play, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { checkRepliesNowAction, resumeRemindersAction } from "@/app/app/reponses/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { PromiseDialog } from "./PromiseDialog";

/** Lire la boîte sans attendre le passage automatique (toutes les 30 minutes). */
export function CheckRepliesButton() {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <Button
      variant="secondary"
      icon={<RefreshCw aria-hidden />}
      status={isPending ? "loading" : "idle"}
      loadingLabel="Lecture de la boîte…"
      onClick={() =>
        startTransition(async () => {
          const result = await checkRepliesNowAction();
          toast.show(result.ok ? { tone: "success", title: result.message } : { tone: "error", title: result.error });
        })
      }
    >
      Vérifier les réponses
    </Button>
  );
}

type ResumeRemindersButtonProps = { invoiceId: string; isPromised: boolean };

/** Reprise des relances d'une facture en pause (ou sous promesse : la promesse est alors abandonnée). */
export function ResumeRemindersButton({ invoiceId, isPromised }: ResumeRemindersButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const resume = () =>
    startTransition(async () => {
      setError(null);
      const result = await resumeRemindersAction({ invoiceId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIsConfirmOpen(false);
      toast.show({ tone: "success", title: result.message });
    });

  return (
    <>
      <Button variant="secondary" icon={<Play aria-hidden />} onClick={() => setIsConfirmOpen(true)}>
        Reprendre les relances
      </Button>
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Reprendre les relances"
        description={
          isPromised
            ? "La promesse en cours sera considérée comme non tenue, et la prochaine relance sera préparée selon le scénario."
            : "Les réponses en attente sont classées, et la prochaine relance sera préparée selon le scénario."
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)}>
              Retour
            </Button>
            <Button status={isPending ? "loading" : "idle"} onClick={resume}>
              Reprendre
            </Button>
          </>
        }
      >
        {error ? <FormMessage tone="error">{error}</FormMessage> : <span />}
      </Modal>
    </>
  );
}

type RecordPromiseButtonProps = { invoiceId: string; invoiceAmount: number; currency: string; today: string };

export function RecordPromiseButton(props: RecordPromiseButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" icon={<HandCoins aria-hidden />} onClick={() => setIsOpen(true)}>
        Noter une promesse
      </Button>
      <PromiseDialog {...props} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
