import type { BadgeTone } from "@/components/ui/Badge";
import type { Enums } from "@/lib/supabase/database.types";

/** Libellés des réponses des clients (§5.6). Ils décrivent le message, jamais la personne (§2.4). */

export type ReplyKind = Enums<"reply_kind">;

export const REPLY_KIND_LABELS: Readonly<Record<ReplyKind, { label: string; tone: BadgeTone }>> = {
  promise: { label: "Promesse de règlement", tone: "success" },
  paid_claim: { label: "Règlement annoncé", tone: "success" },
  dispute: { label: "Contestation", tone: "danger" },
  other: { label: "Réponse", tone: "accent" },
  auto_reply: { label: "Réponse automatique", tone: "neutral" },
  bounce: { label: "Adresse injoignable", tone: "warning" },
};

/** Ce que Relia a fait à réception, dit au client. */
const REPLY_KIND_EXPLANATIONS: Readonly<Record<ReplyKind, string>> = {
  promise:
    "Le client annonce un règlement, mais Relia n'a pas noté de promesse (date incertaine, ou promesse précédente non tenue). Les relances sont en pause : notez la promesse si elle vous convient.",
  paid_claim: "Le client indique avoir déjà réglé. Vérifiez votre compte : les relances sont en pause en attendant.",
  dispute: "Le client conteste la facture. Les relances sont en pause le temps de régler le désaccord.",
  other: "Le client a répondu. Les relances sont en pause jusqu'à ce que vous décidiez de la suite.",
  auto_reply: "Message d'absence : les relances continuent normalement.",
  bounce: "La relance n'a pas pu être remise : l'adresse e-mail du client semble erronée. Les relances sont en pause.",
};

/** Promesse notée d'office : le membre la vérifie, la corrige ou reprend les relances. */
const APPLIED_PROMISE_EXPLANATION =
  "Le client annonce un règlement : Relia a noté la promesse, et aucune relance ne part avant sa date. Vérifiez-la ou corrigez-la.";

export function replyExplanation(kind: ReplyKind, hasAppliedPromise: boolean): string {
  return kind === "promise" && hasAppliedPromise ? APPLIED_PROMISE_EXPLANATION : REPLY_KIND_EXPLANATIONS[kind];
}
