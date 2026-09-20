import { describe, expect, it } from "vitest";
import { describeAuditAction, describeActor } from "./describe";

describe("describeAuditAction", () => {
  it("décrit la création d'une facture selon sa source", () => {
    expect(describeAuditAction("invoice.created", { source: "csv" })).toBe("Facture créée par import CSV");
    expect(describeAuditAction("invoice.created", { source: "manual" })).toBe("Facture saisie à la main");
    expect(describeAuditAction("invoice.created", { source: "facturx" })).toBe("Facture créée depuis une facture Factur-X");
  });

  it("décrit un changement de statut et les relances annulées", () => {
    expect(describeAuditAction("invoice.status_changed", { from: "late", to: "paid", reminders_cancelled: 2 })).toBe(
      "Statut : En retard → Payée · 2 relances annulées",
    );
    expect(describeAuditAction("invoice.status_changed", { from: "paid", to: "pending", reminders_cancelled: 0 })).toBe(
      "Statut : Payée → En attente",
    );
  });

  it("nomme les champs modifiés en français", () => {
    expect(describeAuditAction("invoice.updated", { fields: ["amount_ttc", "due_at"] })).toBe(
      "Facture modifiée : montant TTC, échéance",
    );
  });

  it("résume un import", () => {
    expect(describeAuditAction("invoices.imported", { source: "csv", created: 12, skipped: 1, debtors_created: 3 })).toBe(
      "Import CSV : 12 factures créées, 1 ignorée, 3 nouveaux clients",
    );
  });

  it("décrit l'export et l'effacement d'un client (droits RGPD)", () => {
    expect(describeAuditAction("debtor.exported", {})).toBe("Données du client exportées (droit d'accès)");
    expect(describeAuditAction("debtor.deleted", { invoices_deleted: 3 })).toBe(
      "Client effacé avec ses données (droit à l'effacement), 3 factures supprimées",
    );
  });

  it("décrit la boîte d'envoi et les scénarios", () => {
    expect(describeAuditAction("mailbox.connected", { provider: "gmail" })).toBe("Boîte d'envoi connectée (Gmail)");
    expect(describeAuditAction("mailbox.disconnected", {})).toBe("Boîte d'envoi déconnectée");
    expect(describeAuditAction("sequence.updated", { steps: 4 })).toBe("Scénario de relance modifié (4 étapes)");
  });

  it("décrit le cycle d'une relance", () => {
    expect(describeAuditAction("reminder.planned", { awaiting_approval: true })).toBe("Relance préparée, en attente de validation");
    expect(describeAuditAction("reminder.approved", { edited: true })).toBe("Relance retouchée et validée");
    expect(describeAuditAction("reminder.sent", {})).toBe("Relance envoyée depuis la boîte d'envoi");
    expect(describeAuditAction("reminder.sent", { after_cancel: true })).toMatch(/sortait du cycle/);
  });

  it("décrit les réponses des clients et les promesses", () => {
    expect(describeAuditAction("reply.received", { kind: "dispute", paused: true })).toBe(
      "Réponse du client reçue (contestation) · relances en pause",
    );
    expect(describeAuditAction("reply.received", { kind: "promise", promise_recorded: true })).toBe(
      "Réponse du client reçue (promesse de règlement) · promesse enregistrée",
    );
    expect(describeAuditAction("reply.received", { kind: "auto_reply" })).toBe("Réponse du client reçue (message d'absence)");
    expect(describeAuditAction("reply.resolved", { resolution: "resume" })).toBe("Réponse traitée, relances reprises");
    expect(describeAuditAction("promise.recorded", { source: "email_reply", promised_date: "2026-09-30" })).toBe(
      "Promesse de règlement détectée dans une réponse pour le 30/09/2026",
    );
    expect(describeAuditAction("promise.recorded", { source: "manual" })).toBe("Promesse de règlement notée");
    expect(describeAuditAction("promise.broken", {})).toBe("Promesse non tenue : relances reprises");
    expect(describeAuditAction("invoice.reminders_resumed", { promises_abandoned: 1 })).toBe(
      "Relances reprises, promesse en cours abandonnée",
    );
  });

  it("décrit l'abonnement et les réglages de l'organisation", () => {
    expect(describeAuditAction("subscription.updated", { plan: "pro", status: "active" })).toBe("Abonnement Pro : actif");
    expect(describeAuditAction("subscription.updated", { plan: "business", status: "active", cancel_at_period_end: true })).toBe(
      "Abonnement Business : actif, résiliation programmée",
    );
    expect(describeAuditAction("subscription.updated", { plan: "starter", status: "past_due" })).toBe(
      "Abonnement Essentiel : paiement en échec",
    );
    expect(describeAuditAction("organization.retention_changed", {})).toBe("Durée de conservation des données modifiée");
  });

  it("décrit la purge au terme de la conservation", () => {
    expect(describeAuditAction("data.purged", { invoices: 3, debtors: 1, audit_logs: 0 })).toBe(
      "Données effacées au terme de la durée de conservation : 3 factures, 1 client",
    );
  });

  it("reste lisible pour une action inconnue ou une charge utile inattendue", () => {
    expect(describeAuditAction("mystere.action", null)).toBe("mystere.action");
    expect(describeAuditAction("invoice.status_changed", { from: 42 })).toBe("Statut modifié");
  });
});

describe("describeActor", () => {
  it("nomme le système, l'IA ou le membre", () => {
    expect(describeActor("system", null)).toBe("Relia (automatique)");
    expect(describeActor("ai", null)).toBe("Assistant IA");
    expect(describeActor("user", "Nina Fondatrice")).toBe("Nina Fondatrice");
    expect(describeActor("user", null)).toBe("Membre supprimé");
  });
});
