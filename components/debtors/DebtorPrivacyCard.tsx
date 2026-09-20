"use client";

import { Download, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteDebtorAction } from "@/app/app/debiteurs/actions";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Modal } from "@/components/ui/Modal";

type DebtorPrivacyCardProps = { debtorId: string; debtorName: string; canErase: boolean };

/**
 * Droits de la personne (§2.2) : le client, responsable de traitement, peut répondre à une demande
 * d'accès (export) ou d'effacement de son débiteur.
 */
export function DebtorPrivacyCard({ debtorId, debtorName, canErase }: DebtorPrivacyCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isConfirmed = confirmation.trim().toLowerCase() === debtorName.trim().toLowerCase();

  const erase = () => {
    if (!isConfirmed) return;
    startTransition(async () => {
      const result = await deleteDebtorAction({ debtorId });
      // En cas de succès, l'action redirige vers la liste.
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Données personnelles</CardTitle>
        <CardDescription>Pour répondre à une demande d&apos;accès ou d&apos;effacement de ce client.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <a href={`/app/debiteurs/${debtorId}/export`} download className={buttonClasses({ variant: "secondary" })}>
          <Download aria-hidden />
          Exporter ses données
        </a>
        {canErase ? (
          <Button variant="ghost" icon={<Trash2 aria-hidden />} onClick={() => setIsOpen(true)} className="text-danger">
            Effacer ce client
          </Button>
        ) : (
          <p className="text-xs text-fg-muted">L&apos;effacement est réservé au propriétaire et aux administrateurs.</p>
        )}
      </CardContent>

      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setConfirmation("");
          setError(null);
        }}
        title="Effacer ce client"
        description="Le client, ses factures, relances et promesses sont supprimés de Relia, définitivement. Vos documents comptables ne sont pas concernés. Le journal garde la trace de l'effacement, sans donnée personnelle."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Retour
            </Button>
            <Button variant="danger" status={isPending ? "loading" : "idle"} disabled={!isConfirmed} onClick={erase}>
              Effacer définitivement
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={`Pour confirmer, saisissez « ${debtorName} »`}>
            <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
          </Field>
          {error && <FormMessage tone="error">{error}</FormMessage>}
        </div>
      </Modal>
    </Card>
  );
}
