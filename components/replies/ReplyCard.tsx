"use client";

import { Archive, Check, CircleCheck, HandCoins, Pencil, Play, TriangleAlert, UserPen } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { resolveReplyAction, type ReplyActionResult } from "@/app/app/reponses/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card, CardContent } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/toast/ToastProvider";
import type { ReplyItem } from "@/lib/data/replies";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { replyExplanation } from "@/lib/replies/labels";
import { PromiseDialog } from "./PromiseDialog";
import { AiAnalysisBadge, ReplyKindBadge } from "./ReplyKindBadge";

type ReplyCardProps = { reply: ReplyItem; today: string };

const OPEN_STATUSES = new Set(["pending", "late", "promised"]);

function PromiseSummary({ promise, currency }: { promise: NonNullable<ReplyItem["promise"]>; currency: string }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
      <HandCoins aria-hidden className="size-4 text-success" />
      <span className="tabular-nums">
        Promesse enregistrée : {promise.amount === null ? "la totalité" : formatCurrency(promise.amount, currency)} le{" "}
        {formatDate(promise.date)}
      </span>
      {promise.kept !== null && <Badge tone={promise.kept ? "success" : "danger"}>{promise.kept ? "Tenue" : "Non tenue"}</Badge>}
    </p>
  );
}

/** Une réponse d'un client : ce qu'il a écrit, ce que Relia a compris, et la décision à prendre. */
export function ReplyCard({ reply, today }: ReplyCardProps) {
  const [dialog, setDialog] = useState<"promise" | "paid" | null>(null);
  const [paidAt, setPaidAt] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const isNew = reply.status === "new";
  const isOpen = OPEN_STATUSES.has(reply.invoice.status);
  const canResume = isOpen && (reply.invoice.isPaused || reply.invoice.status === "promised");
  // Promesse notée d'office à partir de cette réponse, toujours en cours.
  const hasAppliedPromise = reply.promise !== null && reply.invoice.status === "promised";

  const run = (task: () => Promise<ReplyActionResult>, onDone?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await task();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone?.();
      toast.show({ tone: "success", title: result.message });
    });

  const resolve = (resolution: "keep_paused" | "resume" | "dispute" | "paid", onDone?: () => void) =>
    run(() => resolveReplyAction({ replyId: reply.id, resolution, paidAt: resolution === "paid" ? paidAt : null }), onDone);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Link href={`/app/factures/${reply.invoice.id}`} className="font-medium text-fg hover:underline">
              {reply.debtor.name} · facture {reply.invoice.number}
            </Link>
            <span className="text-sm text-fg-muted tabular-nums">
              {formatCurrency(reply.invoice.amountTtc, reply.invoice.currency)} · reçue le {formatDateTime(reply.receivedAt)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ReplyKindBadge kind={reply.kind} />
            {reply.isAiClassified && <AiAnalysisBadge />}
          </div>
        </div>

        {reply.excerpt && (
          <blockquote className="rounded-lg border-l-2 border-glow bg-surface/40 px-4 py-3 text-sm whitespace-pre-line text-fg">
            {reply.excerpt}
          </blockquote>
        )}
        {reply.promise && <PromiseSummary promise={reply.promise} currency={reply.invoice.currency} />}
        {isNew && <p className="text-sm text-fg-muted">{replyExplanation(reply.kind, hasAppliedPromise)}</p>}
        {error && <FormMessage tone="error">{error}</FormMessage>}

        {isNew ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            {!hasAppliedPromise && (
              <Button variant="ghost" icon={<Archive aria-hidden />} onClick={() => resolve("keep_paused")}>
                {isOpen ? "Garder en pause" : "Classer"}
              </Button>
            )}
            {canResume && (
              <Button variant="secondary" icon={<Play aria-hidden />} onClick={() => resolve("resume")}>
                Reprendre les relances
              </Button>
            )}
            {isOpen && reply.kind === "bounce" && (
              <Link href={`/app/debiteurs/${reply.debtor.id}`} className={buttonClasses({ variant: "primary" })}>
                <UserPen aria-hidden className="size-4" />
                Corriger l&apos;adresse
              </Link>
            )}
            {isOpen && reply.kind === "dispute" && (
              <Button icon={<TriangleAlert aria-hidden />} status={isPending ? "loading" : "idle"} onClick={() => resolve("dispute")}>
                Signaler un litige
              </Button>
            )}
            {isOpen && reply.kind === "paid_claim" && (
              <Button icon={<CircleCheck aria-hidden />} onClick={() => setDialog("paid")}>
                Marquer comme payée
              </Button>
            )}
            {isOpen && reply.kind !== "bounce" && (
              <Button
                variant={!hasAppliedPromise && (reply.kind === "promise" || reply.kind === "other") ? "primary" : "secondary"}
                icon={hasAppliedPromise ? <Pencil aria-hidden /> : <HandCoins aria-hidden />}
                onClick={() => setDialog("promise")}
              >
                {hasAppliedPromise ? "Corriger la promesse" : "Noter une promesse"}
              </Button>
            )}
            {hasAppliedPromise && (
              <Button icon={<Check aria-hidden />} status={isPending ? "loading" : "idle"} onClick={() => resolve("keep_paused")}>
                C&apos;est noté
              </Button>
            )}
          </div>
        ) : (
          reply.handledAt && (
            <p className="border-t border-border pt-4 text-xs text-fg-muted">
              {reply.kind === "auto_reply" ? "Classée automatiquement" : "Traitée"} le {formatDateTime(reply.handledAt)}
            </p>
          )
        )}
      </CardContent>

      <PromiseDialog
        invoiceId={reply.invoice.id}
        replyId={reply.id}
        invoiceAmount={reply.invoice.amountTtc}
        currency={reply.invoice.currency}
        today={today}
        isOpen={dialog === "promise"}
        onClose={() => setDialog(null)}
      />
      <Modal
        isOpen={dialog === "paid"}
        onClose={() => setDialog(null)}
        title="Marquer la facture comme payée"
        description="Vérifiez que le règlement est bien arrivé sur votre compte : les relances de cette facture s'arrêtent."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Retour
            </Button>
            <Button status={isPending ? "loading" : "idle"} onClick={() => resolve("paid", () => setDialog(null))}>
              Confirmer le règlement
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Date du règlement">
            <Input type="date" value={paidAt} max={today} onChange={(event) => setPaidAt(event.target.value)} />
          </Field>
          {error && <FormMessage tone="error">{error}</FormMessage>}
        </div>
      </Modal>
    </Card>
  );
}
