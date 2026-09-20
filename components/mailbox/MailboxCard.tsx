"use client";

import { Inbox, Mail, Send, Unplug } from "lucide-react";
import { useState, useTransition } from "react";
import { disconnectMailboxAction, sendTestEmailAction } from "@/app/app/boite-mail/actions";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/FormMessage";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { formatDateTime } from "@/lib/format";
import { readsReplies } from "@/lib/mail/replies-reading";

type MailboxCardProps = {
  mailbox: {
    provider: "gmail" | "outlook" | "smtp";
    emailAddress: string;
    displayName: string | null;
    status: "pending" | "active" | "error" | "revoked";
    lastVerifiedAt: string | null;
    smtpHost: string | null;
    imapHost: string | null;
    repliesCheckedAt: string | null;
    repliesError: string | null;
  };
  canManage: boolean;
};

/** Lecture des réponses (§5.6) : Gmail et Outlook par leur API, le repli SMTP par IMAP s'il est renseigné. */
function RepliesStatus({ mailbox }: { mailbox: MailboxCardProps["mailbox"] }) {
  if (!readsReplies(mailbox)) {
    return (
      <FormMessage tone="info">
        Relia ne lit pas les réponses de vos clients : elles arrivent dans votre messagerie et les relances continuent. Pour
        qu&apos;une réponse suspende les relances, reconnectez la boîte en indiquant son serveur IMAP.
      </FormMessage>
    );
  }
  if (mailbox.repliesError) {
    return <FormMessage tone="error">Lecture des réponses impossible : {mailbox.repliesError}</FormMessage>;
  }
  return (
    <p className="flex items-center gap-2 text-sm text-fg-muted">
      <Inbox aria-hidden className="size-4 shrink-0 text-success" />
      Réponses de vos clients lues automatiquement
      {mailbox.repliesCheckedAt ? ` · dernière lecture le ${formatDateTime(mailbox.repliesCheckedAt)}` : " · première lecture à venir"}
    </p>
  );
}

const PROVIDER_LABELS = { gmail: "Gmail", outlook: "Outlook", smtp: "SMTP" } as const;

const STATUS: Readonly<Record<MailboxCardProps["mailbox"]["status"], { label: string; tone: BadgeTone }>> = {
  active: { label: "Opérationnelle", tone: "success" },
  pending: { label: "À vérifier", tone: "warning" },
  error: { label: "À reconnecter", tone: "danger" },
  revoked: { label: "Accès retiré", tone: "danger" },
};

/** Boîte connectée : les relances partent d'ici, à son nom. */
export function MailboxCard({ mailbox, canManage }: MailboxCardProps) {
  const [isTesting, startTest] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const status = STATUS[mailbox.status];

  const sendTest = () =>
    startTest(async () => {
      setError(null);
      const result = await sendTestEmailAction();
      if (result.ok) toast.show({ tone: "success", title: result.message });
      else setError(result.error);
    });

  const disconnect = () =>
    startDisconnect(async () => {
      const result = await disconnectMailboxAction();
      setIsConfirmOpen(false);
      if (result.ok) toast.show({ tone: "success", title: result.message });
      else setError(result.error);
    });

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-surface text-link">
              <Mail aria-hidden className="size-5" />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{mailbox.displayName ?? mailbox.emailAddress}</span>
              <span className="text-sm text-fg-muted">
                {mailbox.emailAddress} · {PROVIDER_LABELS[mailbox.provider]}
                {mailbox.smtpHost && ` (${mailbox.smtpHost})`}
              </span>
            </div>
          </div>
          <Badge tone={status.tone} hasPulse={mailbox.status === "error"}>
            {status.label}
          </Badge>
        </div>

        {mailbox.status === "error" && (
          <FormMessage tone="error">
            L&apos;accès à cette boîte a été refusé (mot de passe changé ou autorisation retirée). Reconnectez-la : aucune
            relance ne part en attendant.
          </FormMessage>
        )}
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {mailbox.status === "active" && <RepliesStatus mailbox={mailbox} />}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-xs text-fg-muted">
            {mailbox.lastVerifiedAt ? `Dernier envoi réussi le ${formatDateTime(mailbox.lastVerifiedAt)}` : "Jamais vérifiée"}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Send aria-hidden />} status={isTesting ? "loading" : "idle"} onClick={sendTest}>
              M&apos;envoyer un e-mail de test
            </Button>
            {canManage && (
              <Button variant="ghost" icon={<Unplug aria-hidden />} onClick={() => setIsConfirmOpen(true)}>
                Déconnecter
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Déconnecter la boîte d'envoi"
        description="Relia efface ses accès à votre messagerie. Plus aucune relance ne partira tant qu'une boîte n'est pas reconnectée."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)}>
              Retour
            </Button>
            <Button variant="danger" status={isDisconnecting ? "loading" : "idle"} onClick={disconnect}>
              Déconnecter
            </Button>
          </>
        }
      >
        <span />
      </Modal>
    </Card>
  );
}
