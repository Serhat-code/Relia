"use client";

import { useState, useTransition } from "react";
import { recordPromiseAction } from "@/app/app/reponses/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { formatCurrency } from "@/lib/format";
import { addDays } from "@/lib/invoices/dates";
import { MAX_MANUAL_PROMISE_DAYS, PROMISE_GRACE_DAYS } from "@/lib/replies/promises";

type PromiseDialogProps = {
  invoiceId: string;
  /** Réponse d'où vient la promesse : elle est classée en même temps. */
  replyId?: string | null;
  invoiceAmount: number;
  currency: string;
  today: string;
  isOpen: boolean;
  onClose: () => void;
};

/** Promesse notée par un membre (téléphone, courrier, réponse dont la date n'a pas été lue). */
export function PromiseDialog({ invoiceId, replyId = null, invoiceAmount, currency, today, isOpen, onClose }: PromiseDialogProps) {
  const [promisedDate, setPromisedDate] = useState("");
  const [promisedAmount, setPromisedAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await recordPromiseAction({ invoiceId, replyId, promisedDate, promisedAmount });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.show({ tone: "success", title: result.message });
      setPromisedDate("");
      setPromisedAmount("");
      onClose();
    });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Noter une promesse de règlement"
      description={`Aucune relance ne part avant la date promise. Sans règlement ${PROMISE_GRACE_DAYS} jours après, les relances reprennent d'elles-mêmes.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Retour
          </Button>
          <Button status={isPending ? "loading" : "idle"} onClick={submit}>
            Enregistrer la promesse
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Date promise" isRequired>
          <Input
            type="date"
            value={promisedDate}
            min={today}
            max={addDays(today, MAX_MANUAL_PROMISE_DAYS)}
            onChange={(event) => setPromisedDate(event.target.value)}
          />
        </Field>
        <Field label="Montant promis" hint={`Laissez vide pour la totalité (${formatCurrency(invoiceAmount, currency)}).`}>
          <Input inputMode="decimal" value={promisedAmount} onChange={(event) => setPromisedAmount(event.target.value)} />
        </Field>
        {error && <FormMessage tone="error">{error}</FormMessage>}
      </div>
    </Modal>
  );
}
