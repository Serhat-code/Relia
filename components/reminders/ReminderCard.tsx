"use client";

import { Check, Pencil, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { approveReminderAction, cancelReminderAction } from "@/app/app/relances/actions";
import { MessagePreview } from "@/components/templates/MessagePreview";
import { ToneBadge } from "@/components/templates/ToneBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { findTemplateViolations } from "@/lib/compliance/template-rules";
import type { ReminderItem } from "@/lib/data/reminders";
import { formatCurrency, formatDateTime } from "@/lib/format";

type ReminderCardProps = { reminder: ReminderItem; senderName: string };

/** Une relance de la file : aperçu tel que le client la recevra, validation, retouche ou annulation. */
export function ReminderCard({ reminder, senderName }: ReminderCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [subject, setSubject] = useState(reminder.subject);
  const [body, setBody] = useState(reminder.body);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const isAwaiting = reminder.status === "awaiting_approval";
  const canCancel = isAwaiting || reminder.status === "scheduled";
  const violations = isEditing ? findTemplateViolations({ clientType: reminder.debtor.clientType, subject, body }) : [];
  const isEdited = subject !== reminder.subject || body !== reminder.body;

  const run = (task: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await task();
      if (result.ok) toast.show({ tone: "success", title: result.message });
      else setError(result.error);
    });

  const approve = () =>
    run(() =>
      approveReminderAction({
        reminderId: reminder.id,
        subject: isEdited ? subject : null,
        body: isEdited ? body : null,
        clientType: reminder.debtor.clientType,
      }),
    );

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Link href={`/app/factures/${reminder.invoice.id}`} className="font-medium text-fg hover:underline">
              {reminder.debtor.name} · facture {reminder.invoice.number}
            </Link>
            <span className="text-sm text-fg-muted tabular-nums">
              {formatCurrency(reminder.invoice.amountTtc, reminder.invoice.currency)} ·{" "}
              {reminder.sentAt ? `envoyée le ${formatDateTime(reminder.sentAt)}` : `prévue le ${formatDateTime(reminder.scheduledAt)}`}
              {reminder.debtor.email && ` · à ${reminder.debtor.email}`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {reminder.tone && <ToneBadge tone={reminder.tone} />}
            {reminder.isAiGenerated && (
              <Badge tone="accent">
                <Sparkles aria-hidden className="size-3" />
                Message assisté par IA
              </Badge>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="flex flex-col gap-4">
            <Field label="Objet">
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
            </Field>
            <Field label="Message" hint="**texte** pour mettre en gras ; une ligne vide sépare les paragraphes.">
              <Textarea rows={10} value={body} onChange={(event) => setBody(event.target.value)} className="text-sm" />
            </Field>
            {violations.length > 0 && <FormMessage tone="error">{violations.join(" ")}</FormMessage>}
          </div>
        ) : (
          <MessagePreview from={senderName} subject={subject} bodyMarkdown={body} />
        )}

        {reminder.status === "failed" && reminder.error && <FormMessage tone="error">Échec de l&apos;envoi : {reminder.error}</FormMessage>}
        {error && <FormMessage tone="error">{error}</FormMessage>}

        {(isAwaiting || canCancel) && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            {canCancel && (
              <Button variant="ghost" icon={<X aria-hidden />} onClick={() => run(() => cancelReminderAction({ reminderId: reminder.id }))}>
                Annuler la relance
              </Button>
            )}
            {isAwaiting && (
              <Button variant="secondary" icon={<Pencil aria-hidden />} onClick={() => setIsEditing((value) => !value)}>
                {isEditing ? "Voir l'aperçu" : "Retoucher"}
              </Button>
            )}
            {isAwaiting && (
              <Button icon={<Check aria-hidden />} status={isPending ? "loading" : "idle"} onClick={approve}>
                Valider et envoyer
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
