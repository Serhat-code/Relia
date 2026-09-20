"use client";

import { Ban, CircleCheck, RotateCcw, TriangleAlert } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { changeInvoiceStatusAction } from "@/app/app/factures/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/toast/ToastProvider";
import type { InvoiceStatus } from "@/lib/invoices/status";
import { availableActions, STATUS_ACTION_LABELS, type StatusAction } from "@/lib/invoices/transitions";

type Confirmation = { title: string; description: string; confirmLabel: string; success: string; isDanger?: boolean };

const CONFIRMATIONS: Readonly<Record<StatusAction, Confirmation>> = {
  mark_paid: {
    title: "Marquer la facture comme payée",
    description: "Les relances prévues pour cette facture seront annulées.",
    confirmLabel: "Confirmer le règlement",
    success: "Facture marquée comme payée.",
  },
  mark_disputed: {
    title: "Signaler un litige",
    description:
      "Le client conteste la facture : les relances prévues sont annulées le temps de régler le désaccord. Vous pourrez rouvrir la facture ensuite.",
    confirmLabel: "Signaler le litige",
    success: "Litige enregistré, relances suspendues.",
  },
  cancel: {
    title: "Annuler la facture",
    description: "La facture ne sera plus suivie ni relancée. Vous pourrez la rouvrir si besoin.",
    confirmLabel: "Annuler la facture",
    success: "Facture annulée.",
    isDanger: true,
  },
  reopen: {
    title: "Rouvrir la facture",
    description: "La facture redevient due : elle reprendra sa place dans le suivi des règlements.",
    confirmLabel: "Rouvrir",
    success: "Facture rouverte.",
  },
};

const ICONS: Readonly<Record<StatusAction, ReactNode>> = {
  mark_paid: <CircleCheck aria-hidden />,
  mark_disputed: <TriangleAlert aria-hidden />,
  cancel: <Ban aria-hidden />,
  reopen: <RotateCcw aria-hidden />,
};

type InvoiceStatusActionsProps = { invoiceId: string; status: InvoiceStatus; today: string };

export function InvoiceStatusActions({ invoiceId, status, today }: InvoiceStatusActionsProps) {
  const [pendingAction, setPendingAction] = useState<StatusAction | null>(null);
  const [paidAt, setPaidAt] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const actions = availableActions(status);

  const open = (action: StatusAction) => {
    setError(null);
    setPaidAt(today);
    setPendingAction(action);
  };

  const confirm = () => {
    if (!pendingAction) return;
    const action = pendingAction;
    startTransition(async () => {
      const result = await changeInvoiceStatusAction({
        invoiceId,
        action,
        paidAt: action === "mark_paid" ? paidAt : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPendingAction(null);
      toast.show({ tone: "success", title: CONFIRMATIONS[action].success });
    });
  };

  const confirmation = pendingAction ? CONFIRMATIONS[pendingAction] : null;

  return (
    <>
      {actions.map((action, index) => (
        <Button
          key={action}
          variant={index === 0 && action !== "cancel" ? "primary" : "secondary"}
          icon={ICONS[action]}
          onClick={() => open(action)}
        >
          {STATUS_ACTION_LABELS[action]}
        </Button>
      ))}

      <Modal
        isOpen={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        title={confirmation?.title ?? ""}
        description={confirmation?.description}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingAction(null)}>
              Retour
            </Button>
            <Button
              variant={confirmation?.isDanger ? "danger" : "primary"}
              status={isPending ? "loading" : "idle"}
              onClick={confirm}
            >
              {confirmation?.confirmLabel}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {pendingAction === "mark_paid" && (
            <Field label="Date du règlement">
              <Input type="date" value={paidAt} max={today} onChange={(event) => setPaidAt(event.target.value)} />
            </Field>
          )}
          {error && <FormMessage tone="error">{error}</FormMessage>}
        </div>
      </Modal>
    </>
  );
}
