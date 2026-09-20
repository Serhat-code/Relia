"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { eraseOrganizationAction } from "@/app/app/parametres/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Modal } from "@/components/ui/Modal";
import { IDLE_STATE } from "@/lib/forms/form-state";

/** Suppression définitive de l'organisation (propriétaire seulement), confirmée par la saisie de son nom. */
export function DangerZone({ organizationName }: { organizationName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(eraseOrganizationAction, IDLE_STATE);

  return (
    <Card className="border-danger/40">
      <CardHeader>
        <CardTitle>Supprimer l&apos;organisation</CardTitle>
        <CardDescription>
          Efface définitivement vos factures, clients, relances, réponses, le journal et les comptes de votre équipe.
          L&apos;abonnement éventuel est résilié immédiatement. Exportez d&apos;abord ce que vous souhaitez garder.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-end">
        <Button variant="danger" icon={<Trash2 aria-hidden />} onClick={() => setIsOpen(true)}>
          Supprimer l&apos;organisation
        </Button>
      </CardContent>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Supprimer définitivement l'organisation"
        description="Cette action est irréversible : aucune donnée ne pourra être récupérée."
        size="sm"
      >
        <form action={formAction} className="flex flex-col gap-4">
          <Field label={`Saisissez « ${organizationName} » pour confirmer`} isRequired>
            <Input name="confirmation" autoComplete="off" />
          </Field>
          {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Retour
            </Button>
            <Button type="submit" variant="danger" status={isPending ? "loading" : "idle"} loadingLabel="Suppression…">
              Supprimer définitivement
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
