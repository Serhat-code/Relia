import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, createDatabase } from "./database";
import { createTenant, insertDebtor, insertInvoice, insertSequence, type Tenant } from "./fixtures";

describe("règles métier portées par la base", () => {
  let db: PGlite;
  let tenant: Tenant;

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Règles");
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  describe("§2.4 — pas de score de risque pour une personne physique", () => {
    const setScore = (debtorId: string) => db.query("update debtors set risk_score = 42 where id = $1", [debtorId]);

    it("accepte un score pour une personne morale identifiée par son SIREN", async () => {
      const debtorId = await insertDebtor(db, tenant.organizationId);

      await expect(setScore(debtorId)).resolves.toBeDefined();
    });

    it("refuse un score pour un particulier (B2C)", async () => {
      const debtorId = await insertDebtor(db, tenant.organizationId, {
        clientType: "b2c",
        siren: null,
        isLegalEntity: false,
      });

      await expect(setScore(debtorId)).rejects.toThrow(/debtors_risk_score_legal_entities_only/);
    });

    it("refuse un score pour un professionnel sans SIREN", async () => {
      const debtorId = await insertDebtor(db, tenant.organizationId, { siren: null, isLegalEntity: false });

      await expect(setScore(debtorId)).rejects.toThrow(/debtors_risk_score_legal_entities_only/);
    });

    it("refuse un score pour une entreprise individuelle, même avec un SIREN", async () => {
      const debtorId = await insertDebtor(db, tenant.organizationId, { isLegalEntity: false });

      await expect(setScore(debtorId)).rejects.toThrow(/debtors_risk_score_legal_entities_only/);
    });

    it("une personne morale a forcément un SIREN", async () => {
      await expect(insertDebtor(db, tenant.organizationId, { siren: null, isLegalEntity: true })).rejects.toThrow(
        /debtors_legal_entity_has_siren/,
      );
    });

    it("refuse un SIREN mal formé", async () => {
      await expect(insertDebtor(db, tenant.organizationId, { siren: "12345" })).rejects.toThrow(/debtors_siren_check/);
    });
  });

  describe("factures", () => {
    it("date la clôture quand la facture est payée, l'efface si elle est rouverte", async () => {
      const debtorId = await insertDebtor(db, tenant.organizationId);
      const invoiceId = await insertInvoice(db, tenant.organizationId, debtorId, "CLOTURE-1");
      const closedAt = async () =>
        (await db.query<{ closed_at: Date | null }>("select closed_at from invoices where id = $1", [invoiceId]))
          .rows[0]?.closed_at;

      await db.query("update invoices set status = 'paid', paid_at = '2026-09-10' where id = $1", [invoiceId]);
      expect(await closedAt()).toBeInstanceOf(Date);

      await db.query("update invoices set status = 'disputed', paid_at = null where id = $1", [invoiceId]);
      expect(await closedAt()).toBeNull();
    });

    it("une facture payée a une date de paiement, et seulement elle", async () => {
      const debtorId = await insertDebtor(db, tenant.organizationId);
      const invoiceId = await insertInvoice(db, tenant.organizationId, debtorId, "PAID-1");

      await expect(db.query("update invoices set status = 'paid' where id = $1", [invoiceId])).rejects.toThrow(
        /invoices_paid_at_matches_status/,
      );
    });

    it("refuse une échéance antérieure à l'émission et un TTC inférieur au HT", async () => {
      const debtorId = await insertDebtor(db, tenant.organizationId);
      const insert = (issued: string, due: string, ht: number, ttc: number) =>
        db.query(
          `insert into invoices (organization_id, debtor_id, number, amount_ht, amount_ttc, issued_at, due_at)
           values ($1, $2, gen_random_uuid()::text, $3, $4, $5, $6)`,
          [tenant.organizationId, debtorId, ht, ttc, issued, due],
        );

      await expect(insert("2026-09-10", "2026-09-01", 100, 120)).rejects.toThrow(/invoices_due_after_issue/);
      await expect(insert("2026-09-01", "2026-09-30", 100, 90)).rejects.toThrow(/invoices_ttc_covers_ht/);
    });
  });

  describe("§2.5 — scénarios et modèles B2B / B2C séparés", () => {
    const insertTemplate = (clientType: "b2b" | "b2c", tone = "courtois") =>
      db.query<{ id: string }>(
        `insert into templates (organization_id, name, client_type, tone, subject, body_markdown)
         values ($1, 'Modèle', $2, $3, 's', 'b') returning id`,
        [tenant.organizationId, clientType, tone],
      );
    const insertStep = (sequenceId: string, templateId: string, tone = "courtois") =>
      db.query(
        `insert into reminder_steps (organization_id, sequence_id, position, offset_days, tone, template_id)
         values ($1, $2, 1, 7, $3, $4)`,
        [tenant.organizationId, sequenceId, tone, templateId],
      );

    it("refuse un modèle B2B dans un scénario B2C", async () => {
      const sequenceId = await insertSequence(db, tenant.organizationId, "b2c");
      const template = await insertTemplate("b2b");

      await expect(insertStep(sequenceId, template.rows[0]?.id ?? "")).rejects.toThrow(/client_type/);
    });

    it("accepte un modèle du même type et du même ton", async () => {
      const sequenceId = await insertSequence(db, tenant.organizationId, "b2c");
      const template = await insertTemplate("b2c");

      await expect(insertStep(sequenceId, template.rows[0]?.id ?? "")).resolves.toBeDefined();
    });

    it("refuse un modèle d'un autre ton que l'étape", async () => {
      const sequenceId = await insertSequence(db, tenant.organizationId, "b2b");
      const template = await insertTemplate("b2b", "ferme");

      await expect(insertStep(sequenceId, template.rows[0]?.id ?? "", "courtois")).rejects.toThrow(/ton/);
    });

    it("un seul scénario par défaut par type de client", async () => {
      const setDefault = () =>
        db.query(
          `insert into reminder_sequences (organization_id, name, client_type, is_default) values ($1, 'Défaut', 'b2b', true)`,
          [tenant.organizationId],
        );

      await setDefault();
      await expect(setDefault()).rejects.toThrow(/reminder_sequences_one_default/);
    });
  });
});
