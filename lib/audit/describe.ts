import { formatDate, pluralize } from "@/lib/format";
import { INVOICE_STATUS_LABELS, INVOICE_STATUSES, type InvoiceStatus } from "@/lib/invoices/status";
import type { Enums, Json } from "@/lib/supabase/database.types";

/** Phrases du journal d'audit consultable par le client (§5.8). La charge utile est lue avec prudence. */

type Payload = { [key: string]: Json | undefined };

const asPayload = (payload: Json): Payload =>
  typeof payload === "object" && payload !== null && !Array.isArray(payload) ? payload : {};

const asNumber = (value: Json | undefined) => (typeof value === "number" ? value : 0);

const asStatus = (value: Json | undefined): InvoiceStatus | null =>
  INVOICE_STATUSES.find((status) => status === value) ?? null;

const CREATION_BY_SOURCE: Readonly<Record<string, string>> = {
  manual: "Facture saisie à la main",
  csv: "Facture créée par import CSV",
  facturx: "Facture créée depuis une facture Factur-X",
  pennylane: "Facture synchronisée depuis Pennylane",
  qonto: "Facture synchronisée depuis Qonto",
  stripe: "Facture synchronisée depuis Stripe",
};

const MAIL_PROVIDERS: Readonly<Record<string, string>> = { gmail: "Gmail", outlook: "Outlook", smtp: "SMTP" };

const IMPORT_SOURCES: Readonly<Record<string, string>> = { csv: "CSV", facturx: "Factur-X" };

const FIELD_LABELS: Readonly<Record<string, string>> = {
  number: "numéro",
  debtor_id: "client",
  amount_ht: "montant HT",
  amount_ttc: "montant TTC",
  currency: "devise",
  issued_at: "date d'émission",
  due_at: "échéance",
  paid_at: "date de règlement",
  name: "nom",
  siren: "SIREN",
  is_legal_entity: "forme juridique",
  client_type: "type de client",
  contact_email: "e-mail",
  contact_name: "contact",
  phone: "téléphone",
  address: "adresse",
  notes: "notes",
  risk_score: "score de risque",
};

function fieldList(value: Json | undefined): string {
  const fields = Array.isArray(value) ? value.filter((field): field is string => typeof field === "string") : [];
  return fields.map((field) => FIELD_LABELS[field] ?? field).join(", ");
}

function describeStatusChange(payload: Payload): string {
  const from = asStatus(payload.from);
  const to = asStatus(payload.to);
  if (!from || !to) return "Statut modifié";
  const cancelled = asNumber(payload.reminders_cancelled);
  const suffix = cancelled > 0 ? ` · ${cancelled} ${pluralize(cancelled, "relance annulée", "relances annulées")}` : "";
  return `Statut : ${INVOICE_STATUS_LABELS[from]} → ${INVOICE_STATUS_LABELS[to]}${suffix}`;
}

/** Réponse du client (§5.6) : ce qu'elle dit, et ce que Relia a fait. */
const REPLY_KINDS: Readonly<Record<string, string>> = {
  promise: "promesse de règlement",
  paid_claim: "règlement annoncé",
  dispute: "contestation",
  other: "réponse",
  auto_reply: "message d'absence",
  bounce: "avis de non-remise",
};

function describeReplyReceived(payload: Payload): string {
  const kind = typeof payload.kind === "string" ? (REPLY_KINDS[payload.kind] ?? "réponse") : "réponse";
  const effect =
    payload.promise_recorded === true ? " · promesse enregistrée" : payload.paused === true ? " · relances en pause" : "";
  return `Réponse du client reçue (${kind})${effect}`;
}

const REPLY_RESOLUTIONS: Readonly<Record<string, string>> = {
  keep_paused: "Réponse traitée, sans reprise des relances",
  resume: "Réponse traitée, relances reprises",
  dispute: "Réponse traitée : litige signalé",
  paid: "Réponse traitée : règlement noté",
};

function describePromise(payload: Payload): string {
  const date = typeof payload.promised_date === "string" ? ` pour le ${formatDate(payload.promised_date)}` : "";
  return payload.source === "email_reply"
    ? `Promesse de règlement détectée dans une réponse${date}`
    : `Promesse de règlement notée${date}`;
}

const SUBSCRIPTION_PLANS: Readonly<Record<string, string>> = { starter: "Essentiel", pro: "Pro", business: "Business" };

const SUBSCRIPTION_STATUSES: Readonly<Record<string, string>> = {
  active: "actif",
  trialing: "actif",
  past_due: "paiement en échec",
  canceled: "résilié",
  unpaid: "impayé",
  incomplete: "paiement à finaliser",
  incomplete_expired: "expiré",
  paused: "suspendu",
};

function describeSubscription(payload: Payload): string {
  const plan = typeof payload.plan === "string" ? (SUBSCRIPTION_PLANS[payload.plan] ?? payload.plan) : "";
  const status = typeof payload.status === "string" ? (SUBSCRIPTION_STATUSES[payload.status] ?? payload.status) : "";
  const ending = payload.cancel_at_period_end === true && payload.status === "active" ? ", résiliation programmée" : "";
  return `Abonnement ${plan ? `${plan} ` : ""}: ${status}${ending}`;
}

function describeImport(payload: Payload): string {
  const source = typeof payload.source === "string" ? (IMPORT_SOURCES[payload.source] ?? payload.source) : "";
  const created = asNumber(payload.created);
  const skipped = asNumber(payload.skipped);
  const debtors = asNumber(payload.debtors_created);
  const parts = [
    `${created} ${pluralize(created, "facture créée", "factures créées")}`,
    skipped > 0 && `${skipped} ${pluralize(skipped, "ignorée", "ignorées")}`,
    debtors > 0 && `${debtors} ${pluralize(debtors, "nouveau client", "nouveaux clients")}`,
  ].filter(Boolean);
  return `Import ${source} : ${parts.join(", ")}`;
}

export function describeAuditAction(action: string, rawPayload: Json): string {
  const payload = asPayload(rawPayload);
  switch (action) {
    case "invoice.created":
      return (typeof payload.source === "string" && CREATION_BY_SOURCE[payload.source]) || "Facture créée";
    case "invoice.status_changed":
      return describeStatusChange(payload);
    case "invoice.updated":
      return `Facture modifiée : ${fieldList(payload.fields)}`;
    case "invoices.imported":
      return describeImport(payload);
    case "debtor.created":
      return "Client ajouté";
    case "debtor.updated":
      return `Fiche client modifiée : ${fieldList(payload.fields)}`;
    case "debtor.exported":
      return "Données du client exportées (droit d'accès)";
    case "debtor.deleted": {
      const deleted = asNumber(payload.invoices_deleted);
      return `Client effacé avec ses données (droit à l'effacement), ${deleted} ${pluralize(deleted, "facture supprimée", "factures supprimées")}`;
    }
    case "mailbox.connected": {
      const provider = typeof payload.provider === "string" ? (MAIL_PROVIDERS[payload.provider] ?? payload.provider) : "";
      return provider ? `Boîte d'envoi connectée (${provider})` : "Boîte d'envoi connectée";
    }
    case "mailbox.disconnected":
      return "Boîte d'envoi déconnectée";
    case "mailbox.tested":
      return payload.ok === false ? "E-mail de test en échec" : "E-mail de test envoyé depuis la boîte d'envoi";
    case "mailbox.smtp_checked":
      return payload.ok === false ? "Vérification SMTP refusée" : "Vérification SMTP réussie";
    case "sequence.updated": {
      const steps = asNumber(payload.steps);
      return `Scénario de relance modifié (${steps} ${pluralize(steps, "étape", "étapes")})`;
    }
    case "reminder.planned":
      return payload.awaiting_approval === true ? "Relance préparée, en attente de validation" : "Relance préparée et planifiée";
    case "reminder.approved":
      return payload.edited === true ? "Relance retouchée et validée" : "Relance validée";
    case "reminder.cancelled":
      return "Relance annulée";
    case "reminder.sent":
      return payload.after_cancel === true
        ? "Relance envoyée pendant que la facture sortait du cycle de relance"
        : "Relance envoyée depuis la boîte d'envoi";
    case "reminder.failed":
      return "Échec de l'envoi d'une relance";
    case "reply.received":
      return describeReplyReceived(payload);
    case "reply.resolved":
      return (typeof payload.resolution === "string" && REPLY_RESOLUTIONS[payload.resolution]) || "Réponse traitée";
    case "promise.recorded":
      return describePromise(payload);
    case "promise.broken":
      return "Promesse non tenue : relances reprises";
    case "invoice.reminders_resumed":
      return asNumber(payload.promises_abandoned) > 0 ? "Relances reprises, promesse en cours abandonnée" : "Relances reprises";
    case "replies.checked":
      return payload.ok === false ? "Lecture des réponses en échec" : "Lecture des réponses demandée";
    case "subscription.updated":
      return describeSubscription(payload);
    case "organization.updated":
      return "Informations de l'organisation modifiées";
    case "organization.retention_changed":
      return "Durée de conservation des données modifiée";
    case "data.purged": {
      const invoices = asNumber(payload.invoices);
      const debtors = asNumber(payload.debtors);
      const logs = asNumber(payload.audit_logs);
      const parts = [
        invoices > 0 && `${invoices} ${pluralize(invoices, "facture", "factures")}`,
        debtors > 0 && `${debtors} ${pluralize(debtors, "client", "clients")}`,
        logs > 0 && `${logs} ${pluralize(logs, "entrée du journal", "entrées du journal")}`,
      ].filter(Boolean);
      return `Données effacées au terme de la durée de conservation : ${parts.join(", ")}`;
    }
    case "organization.created":
      return "Organisation créée";
    case "dpa.accepted":
      return typeof payload.version === "string"
        ? `Accord de sous-traitance (DPA) accepté, version ${payload.version}`
        : "Accord de sous-traitance (DPA) accepté";
    default:
      return action;
  }
}

export function describeActor(actorType: Enums<"actor_type">, memberName: string | null): string {
  if (actorType === "system") return "Relia (automatique)";
  if (actorType === "ai") return "Assistant IA";
  return memberName ?? "Membre supprimé";
}
