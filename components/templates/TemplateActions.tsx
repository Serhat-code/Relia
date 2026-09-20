"use client";

import { Copy, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { copyTemplateAction, deleteTemplateAction } from "@/app/app/modeles/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Modal } from "@/components/ui/Modal";
import { pluralize } from "@/lib/format";

/** Créer une copie modifiable d'un modèle (les modèles système restent intacts). */
export function CustomizeTemplateButton({ templateId }: { templateId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        icon={<Copy aria-hidden />}
        status={isPending ? "loading" : "idle"}
        onClick={() =>
          startTransition(async () => {
            const result = await copyTemplateAction({ templateId });
            // En cas de succès, l'action ouvre l'éditeur de la copie.
            if (!result.ok) setError(result.error);
          })
        }
      >
        Personnaliser
      </Button>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </div>
  );
}

type DeleteTemplateButtonProps = { templateId: string; usageCount: number };

export function DeleteTemplateButton({ templateId, usageCount }: DeleteTemplateButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const usage =
    usageCount > 0
      ? ` Il est utilisé par ${usageCount} ${pluralize(usageCount, "étape", "étapes")} de scénario, qui reprendront le modèle Relia du même ton.`
      : "";

  return (
    <>
      <Button variant="ghost" icon={<Trash2 aria-hidden />} className="text-danger" onClick={() => setIsOpen(true)}>
        Supprimer
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Supprimer ce modèle"
        description={`Le modèle personnalisé sera supprimé.${usage}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Retour
            </Button>
            <Button
              variant="danger"
              status={isPending ? "loading" : "idle"}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteTemplateAction({ templateId });
                  if (!result.ok) setError(result.error);
                })
              }
            >
              Supprimer
            </Button>
          </>
        }
      >
        {error ? <FormMessage tone="error">{error}</FormMessage> : <span />}
      </Modal>
    </>
  );
}
