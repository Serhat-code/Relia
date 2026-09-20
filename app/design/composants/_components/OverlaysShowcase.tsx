"use client";

import { Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { formatCurrency } from "@/lib/format";
import { Section } from "../../_components/Section";
import { useSimulatedTask } from "../../_components/use-simulated-task";

const CLOSE_AFTER_SUCCESS_MS = 800;
const SEND_DELAY_MS = 1800;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function SendReminderModal() {
  const [isOpen, setIsOpen] = useState(false);
  const send = useSimulatedTask({ durationMs: 1400 });
  const resetSend = send.set;
  const close = useCallback(() => {
    setIsOpen(false);
    resetSend("idle");
  }, [resetSend]);

  useEffect(() => {
    if (send.phase !== "success") return;
    const timer = window.setTimeout(close, CLOSE_AFTER_SUCCESS_MS);
    return () => window.clearTimeout(timer);
  }, [send.phase, close]);

  const summary = [
    ["Débiteur", "Atelier Morel"],
    ["Facture", `F-2026-0142 · ${formatCurrency(4280)}`],
    ["Ton", "Ferme"],
    ["Depuis", "facturation@votre-entreprise.fr"],
  ] as const;

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        Ouvrir la modale
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={close}
        title="Envoyer la relance ?"
        description="Elle partira de votre propre boîte e-mail, à votre nom."
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Annuler
            </Button>
            <Button icon={<Send />} status={send.phase} loadingLabel="Envoi…" onClick={send.start}>
              {send.phase === "success" ? "Relance envoyée" : "Envoyer"}
            </Button>
          </>
        }
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {summary.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-fg-muted">{term}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <Badge tone="accent" className="mt-4">
          Message assisté par IA
        </Badge>
      </Modal>
    </>
  );
}

function ToastButtons() {
  const toast = useToast();

  const simulateSend = () =>
    toast
      .promise(wait(SEND_DELAY_MS), {
        loading: "Envoi de la relance à Atelier Morel…",
        success: "Relance envoyée depuis votre boîte",
        error: "Échec de l'envoi",
      })
      .catch(() => undefined);

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="secondary"
        onClick={() =>
          toast.show({ tone: "info", title: "Synchronisation terminée", description: "12 nouvelles factures importées." })
        }
      >
        Information
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast.show({ tone: "success", title: "Promesse enregistrée", description: "Règlement annoncé pour le 30/09/2026." })
        }
      >
        Succès
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast.show({
            tone: "error",
            title: "Boîte d'envoi déconnectée",
            description: "Reconnectez-la pour reprendre les relances.",
          })
        }
      >
        Erreur
      </Button>
      <Button onClick={simulateSend}>Envoi : chargement → succès</Button>
    </div>
  );
}

export function OverlaysShowcase() {
  return (
    <Section
      title="Modale et toasts"
      description="Modale : <dialog> natif, focus piégé, Échap, clic sur le fond. Toasts : entrée par la droite avec léger rebond ; le loader d'un envoi se referme en anneau au succès."
    >
      <div className="flex flex-col items-start gap-6 rounded-2xl border border-border bg-elevated p-6">
        <SendReminderModal />
        <ToastButtons />
      </div>
    </Section>
  );
}
