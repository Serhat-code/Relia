import type { ClientType } from "@/lib/debtors/client-type";
import type { Enums } from "@/lib/supabase/database.types";

export type ReminderTone = Enums<"reminder_tone">;

export type SystemTemplate = {
  /** Identifiant fixe : les étapes des scénarios par défaut y sont rattachées. */
  id: string;
  name: string;
  clientType: ClientType;
  tone: ReminderTone;
  subject: string;
  bodyMarkdown: string;
};

/**
 * Modèles fournis par Relia (CLAUDE.md §2.5 et §2.6), insérés par la migration
 * 20260918180000_templates.sql — un test vérifie que la base contient exactement ces textes.
 *
 * B2B : peut rappeler l'indemnité forfaitaire de 40 € et les pénalités (BCE + 10 points).
 * B2C : jamais ; délais plus longs, ton plus mesuré, une solution amiable proposée.
 * Mise en demeure : factuelle — montant, échéance, délai demandé, et le simple fait que le dossier
 * pourra être confié à un tiers. Aucune menace.
 */
export const SYSTEM_TEMPLATES: readonly SystemTemplate[] = [
  {
    id: "5a4d1c3e-0b1b-4c1e-8a01-000000000101",
    name: "Rappel courtois — professionnels",
    clientType: "b2b",
    tone: "courtois",
    subject: "Facture {{numero_facture}} : petit rappel",
    bodyMarkdown: `{{salutation}}

Sauf erreur de notre part, notre facture n° {{numero_facture}} d'un montant de {{montant}} {{statut_echeance}}.

Si le règlement est déjà parti, merci de ne pas tenir compte de ce message. Dans le cas contraire, nous vous remercions de bien vouloir le programmer.

Nous restons à votre disposition pour toute question.

Bien cordialement,
{{nom_entreprise}}`,
  },
  {
    id: "5a4d1c3e-0b1b-4c1e-8a01-000000000102",
    name: "Relance ferme — professionnels",
    clientType: "b2b",
    tone: "ferme",
    subject: "Facture {{numero_facture}} en attente de règlement",
    bodyMarkdown: `{{salutation}}

Malgré notre précédent message, notre facture n° {{numero_facture}} d'un montant de {{montant}}, échue le {{date_echeance}}, reste impayée à ce jour ({{retard}} de retard).

Nous vous remercions de procéder à son règlement dans les meilleurs délais.

Pour rappel, conformément à l'article L441-10 du Code de commerce, tout retard de paiement entre professionnels rend exigibles des pénalités de retard au taux de la BCE majoré de 10 points, ainsi qu'une indemnité forfaitaire de 40 €.

Si un point de la facture pose question, répondez simplement à ce message : nous le regarderons ensemble.

Cordialement,
{{nom_entreprise}}`,
  },
  {
    id: "5a4d1c3e-0b1b-4c1e-8a01-000000000103",
    name: "Mise en demeure — professionnels",
    clientType: "b2b",
    tone: "mise_en_demeure",
    subject: "Mise en demeure de payer : facture {{numero_facture}}",
    bodyMarkdown: `{{salutation}}

Nos précédentes relances concernant la facture n° {{numero_facture}} sont restées sans effet.

**Montant dû :** {{montant}}
**Échéance dépassée :** {{date_echeance}} ({{retard}} de retard)

Par la présente, nous vous mettons en demeure de régler cette somme sous huit jours à compter de la réception de ce message.

Les pénalités de retard au taux de la BCE majoré de 10 points et l'indemnité forfaitaire de 40 € prévues par l'article L441-10 du Code de commerce sont exigibles.

À défaut de règlement dans ce délai, le dossier pourra être confié à un tiers.

{{nom_entreprise}}`,
  },
  {
    id: "5a4d1c3e-0b1b-4c1e-8a01-000000000201",
    name: "Rappel courtois — particuliers",
    clientType: "b2c",
    tone: "courtois",
    subject: "Votre facture {{numero_facture}}",
    bodyMarkdown: `{{salutation}}

Nous nous permettons de vous rappeler que la facture n° {{numero_facture}} d'un montant de {{montant}} {{statut_echeance}}.

Si vous l'avez déjà réglée, merci de ne pas tenir compte de ce message.

Pour toute question, il vous suffit de répondre à cet e-mail.

Bien cordialement,
{{nom_entreprise}}`,
  },
  {
    id: "5a4d1c3e-0b1b-4c1e-8a01-000000000202",
    name: "Relance — particuliers",
    clientType: "b2c",
    tone: "ferme",
    subject: "Facture {{numero_facture}} : règlement en attente",
    bodyMarkdown: `{{salutation}}

Nous n'avons pas encore reçu le règlement de la facture n° {{numero_facture}} d'un montant de {{montant}}, arrivée à échéance le {{date_echeance}}.

Nous vous remercions de bien vouloir procéder à son règlement dès que possible. Si vous rencontrez une difficulté, répondez-nous simplement : nous pouvons en parler et trouver ensemble une solution, par exemple un paiement en plusieurs fois.

Bien cordialement,
{{nom_entreprise}}`,
  },
  {
    id: "5a4d1c3e-0b1b-4c1e-8a01-000000000203",
    name: "Mise en demeure — particuliers",
    clientType: "b2c",
    tone: "mise_en_demeure",
    subject: "Mise en demeure de payer : facture {{numero_facture}}",
    bodyMarkdown: `{{salutation}}

Malgré nos relances, la facture n° {{numero_facture}} reste impayée.

**Montant dû :** {{montant}}
**Échéance :** {{date_echeance}}

Nous vous mettons en demeure de régler cette somme dans un délai de quinze jours à compter de la réception de ce message.

Si vous rencontrez une difficulté de paiement, répondez-nous : nous restons ouverts à un échéancier.

À défaut de règlement dans ce délai, le dossier pourra être confié à un tiers.

{{nom_entreprise}}`,
  },
];

export const REMINDER_TONE_LABELS: Readonly<Record<ReminderTone, string>> = {
  courtois: "Courtois",
  ferme: "Ferme",
  mise_en_demeure: "Mise en demeure",
};
