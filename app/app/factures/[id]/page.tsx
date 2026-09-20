import { ArrowLeft, FileCode2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { InvoiceStatusActions } from "@/components/invoices/InvoiceStatusActions";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { Reveal } from "@/components/motion/Reveal";
import { RecordPromiseButton, ResumeRemindersButton } from "@/components/replies/ReplyControls";
import { AiAnalysisBadge, ReplyKindBadge } from "@/components/replies/ReplyKindBadge";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/FormMessage";
import { listEntityHistory } from "@/lib/data/audit";
import { getInvoice, type InvoiceDetail } from "@/lib/data/invoices";
import { CLIENT_TYPE_LABELS } from "@/lib/debtors/client-type";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { describeDue, todayInParis } from "@/lib/invoices/dates";
import { promiseDeadline } from "@/lib/replies/promises";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const invoice = await getInvoice((await params).id);
  return { title: invoice ? `Facture ${invoice.number}` : "Facture introuvable" };
}

const SOURCE_LABELS: Readonly<Record<InvoiceDetail["source"], string>> = {
  manual: "Saisie manuelle",
  csv: "Import CSV",
  facturx: "Facture électronique Factur-X",
  pennylane: "Pennylane",
  qonto: "Qonto",
  stripe: "Stripe",
};

const REMINDER_STATUS: Readonly<Record<InvoiceDetail["reminders"][number]["status"], { label: string; tone: "neutral" | "accent" | "success" | "danger" }>> = {
  scheduled: { label: "Planifiée", tone: "accent" },
  awaiting_approval: { label: "À valider", tone: "accent" },
  sent: { label: "Envoyée", tone: "success" },
  cancelled: { label: "Annulée", tone: "neutral" },
  failed: { label: "Échec d'envoi", tone: "danger" },
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-fg-muted uppercase">{label}</dt>
      <dd className="text-sm text-fg">{children}</dd>
    </div>
  );
}

function Summary({ invoice, today }: { invoice: InvoiceDetail; today: string }) {
  const isOpen = ["pending", "late", "promised"].includes(invoice.status);
  const due = isOpen ? describeDue(invoice.dueAt, today) : null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-fg-muted">Montant TTC</span>
            <span className="font-display text-2xl font-semibold tabular-nums">
              {formatCurrency(invoice.amountTtc, invoice.currency)}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <InvoiceStatusBadge status={invoice.status} />
            {due && (
              <span className={due.tone === "late" ? "text-sm font-medium text-danger" : "text-sm text-fg-muted"}>
                {due.text}
              </span>
            )}
          </div>
        </div>
        <dl className="grid gap-5 border-t border-border pt-5 sm:grid-cols-3">
          <Detail label="Client">
            <Link href={`/app/debiteurs/${invoice.debtor.id}`} className="font-medium text-link hover:underline">
              {invoice.debtor.name}
            </Link>
            <span className="block text-xs text-fg-muted">{CLIENT_TYPE_LABELS[invoice.debtor.clientType]}</span>
          </Detail>
          <Detail label="Émise le">
            <span className="tabular-nums">{formatDate(invoice.issuedAt)}</span>
          </Detail>
          <Detail label="Échéance">
            <span className="tabular-nums">{formatDate(invoice.dueAt)}</span>
          </Detail>
          <Detail label="Montant HT">
            <span className="tabular-nums">{formatCurrency(invoice.amountHt, invoice.currency)}</span>
          </Detail>
          <Detail label="Réglée le">
            <span className="tabular-nums">{invoice.paidAt ? formatDate(invoice.paidAt) : "—"}</span>
          </Detail>
          <Detail label="Origine">
            {SOURCE_LABELS[invoice.source]}
            {invoice.facturX?.profile && (
              <span className="mt-0.5 flex items-center gap-1 text-xs text-fg-muted">
                <FileCode2 aria-hidden className="size-3.5" />
                Données structurées conservées
              </span>
            )}
          </Detail>
        </dl>
      </CardContent>
    </Card>
  );
}

function Reminders({ invoice }: { invoice: InvoiceDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Relances</CardTitle>
      </CardHeader>
      <CardContent>
        {invoice.reminders.length === 0 ? (
          <p className="text-sm text-fg-muted">
            Aucune relance pour l&apos;instant. Elles seront préparées selon le scénario de relance du client, et
            partiront de votre propre boîte e-mail une fois celle-ci connectée.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {invoice.reminders.map((reminder) => (
              <li key={reminder.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm text-fg">{reminder.subject ?? "Relance"}</span>
                  <span className="text-xs text-fg-muted">
                    {reminder.sentAt ? `Envoyée le ${formatDateTime(reminder.sentAt)}` : `Prévue le ${formatDateTime(reminder.scheduledAt)}`}
                    {reminder.isAiGenerated && " · Message assisté par IA"}
                  </span>
                </div>
                <Badge tone={REMINDER_STATUS[reminder.status].tone}>{REMINDER_STATUS[reminder.status].label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const OPEN_STATUSES = new Set(["pending", "late", "promised"]);

function Replies({ invoice }: { invoice: InvoiceDetail }) {
  if (invoice.replies.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Réponses du client</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border">
          {invoice.replies.map((reply) => (
            <li key={reply.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-fg-muted tabular-nums">
                  Reçue le {formatDateTime(reply.receivedAt)}
                  {reply.status === "new" && " · à traiter"}
                </span>
                <div className="flex flex-wrap gap-2">
                  <ReplyKindBadge kind={reply.kind} />
                  {reply.isAiClassified && <AiAnalysisBadge />}
                </div>
              </div>
              {reply.excerpt && <p className="text-sm whitespace-pre-line text-fg">{reply.excerpt}</p>}
            </li>
          ))}
        </ul>
        {invoice.replies.some((reply) => reply.status === "new") && (
          <Link href="/app/reponses" className="mt-4 inline-block text-sm font-medium text-link hover:underline">
            Traiter les réponses
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function Promises({ invoice, today }: { invoice: InvoiceDetail; today: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Promesses de règlement</CardTitle>
        {OPEN_STATUSES.has(invoice.status) && (
          <RecordPromiseButton invoiceId={invoice.id} invoiceAmount={invoice.amountTtc} currency={invoice.currency} today={today} />
        )}
      </CardHeader>
      <CardContent>
        {invoice.promises.length === 0 ? (
          <p className="text-sm text-fg-muted">
            Aucune promesse. Quand le client répond qu&apos;il réglera à une date donnée, Relia la note ici et suspend les
            relances jusqu&apos;à cette date.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {invoice.promises.map((promise) => (
              <li key={promise.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-fg tabular-nums">
                    {promise.promisedAmount === null
                      ? "Règlement promis"
                      : formatCurrency(promise.promisedAmount, invoice.currency)}{" "}
                    le {formatDate(promise.promisedDate)}
                  </span>
                  <span className="text-xs text-fg-muted">
                    {promise.source === "email_reply" ? "Détectée dans une réponse" : "Notée à la main"}
                    {promise.kept === null && ` · relances reprises après le ${formatDate(promiseDeadline(promise.promisedDate))} sans règlement`}
                  </span>
                </div>
                {promise.kept !== null && (
                  <Badge tone={promise.kept ? "success" : "danger"}>{promise.kept ? "Tenue" : "Non tenue"}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function InvoicePage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  const history = await listEntityHistory("invoice", invoice.id);
  const today = todayInParis();
  const canResume = OPEN_STATUSES.has(invoice.status) && (invoice.remindersPausedAt !== null || invoice.status === "promised");

  return (
    <>
      <Link
        href="/app/factures"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors duration-hover hover:text-fg"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Factures
      </Link>
      <PageHeader
        title={`Facture ${invoice.number}`}
        description={`${invoice.debtor.name} · émise le ${formatDate(invoice.issuedAt)}`}
        actions={
          <>
            {canResume && <ResumeRemindersButton invoiceId={invoice.id} isPromised={invoice.status === "promised"} />}
            <InvoiceStatusActions invoiceId={invoice.id} status={invoice.status} today={today} />
          </>
        }
      />
      <div className="flex flex-col gap-6">
        {query.creee === "1" && (
          <Reveal index={1}>
            <FormMessage tone="success">Facture enregistrée. Relia suit désormais son règlement.</FormMessage>
          </Reveal>
        )}
        {invoice.remindersPausedAt && OPEN_STATUSES.has(invoice.status) && (
          <Reveal index={1}>
            <FormMessage tone="info">
              Relances en pause depuis le {formatDateTime(invoice.remindersPausedAt)} : le client a répondu. Traitez sa
              réponse, notez une promesse, ou reprenez les relances.
            </FormMessage>
          </Reveal>
        )}
        {!invoice.debtor.contactEmail && (
          <Reveal index={1}>
            <FormMessage tone="info">
              Ce client n&apos;a pas d&apos;adresse e-mail : ajoutez-la sur{" "}
              <Link href={`/app/debiteurs/${invoice.debtor.id}`} className="font-medium text-link hover:underline">
                sa fiche
              </Link>{" "}
              pour que les relances puissent partir.
            </FormMessage>
          </Reveal>
        )}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Reveal index={1}>
              <Summary invoice={invoice} today={today} />
            </Reveal>
            <Reveal index={2}>
              <Reminders invoice={invoice} />
            </Reveal>
            <Reveal index={3}>
              <Replies invoice={invoice} />
            </Reveal>
            <Reveal index={4}>
              <Promises invoice={invoice} today={today} />
            </Reveal>
          </div>
          <Reveal index={2}>
            <Card>
              <CardHeader>
                <CardTitle>Historique</CardTitle>
              </CardHeader>
              <CardContent>
                <AuditTimeline entries={history} />
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </>
  );
}
