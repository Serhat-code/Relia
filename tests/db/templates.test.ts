import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { B2C_FORBIDDEN_MENTIONS, THREAT_TERMS } from "@/lib/compliance/template-rules";
import { SYSTEM_TEMPLATES } from "@/lib/templates/system-templates";
import { DB_TEST_TIMEOUT_MS, asService, asUser, createDatabase } from "./database";
import { createTenant, type Tenant } from "./fixtures";

describe("modèles de relance (palier 8)", () => {
  let db: PGlite;
  let tenant: Tenant;

  const insertTemplate = (clientType: "b2b" | "b2c", body: string) =>
    asUser(db, tenant.userId, (tx) =>
      tx.query(
        `insert into templates (organization_id, name, client_type, tone, subject, body_markdown)
         values ($1, 'Essai', $2, 'courtois', 'Relance', $3)`,
        [tenant.organizationId, clientType, body],
      ),
    );

  beforeAll(async () => {
    db = await createDatabase();
    const userId = crypto.randomUUID();
    await db.query("insert into auth.users (id, email) values ($1, 'modeles@atelier.example')", [userId]);
    const organizationId = await asService(db, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "select public.provision_organization($1, 'modeles@atelier.example', 'Camille', 'Atelier Modèles', '', '2026-09', '203.0.113.9') as id",
        [userId],
      );
      return rows[0]?.id ?? "";
    });
    tenant = { organizationId, userId };
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("la base contient exactement les modèles système du code", async () => {
    const { rows } = await db.query<Record<string, string>>(
      `select id, name, client_type, tone, subject, body_markdown from templates where is_system order by id`,
    );

    expect(rows).toEqual(
      [...SYSTEM_TEMPLATES]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((system) => ({
          id: system.id,
          name: system.name,
          client_type: system.clientType,
          tone: system.tone,
          subject: system.subject,
          body_markdown: system.bodyMarkdown,
        })),
    );
  });

  it("chaque étape des scénarios par défaut utilise le modèle système de son type et de son ton", async () => {
    const { rows } = await asUser(db, tenant.userId, (tx) =>
      tx.query<{ matches: boolean }>(
        `select template.client_type = sequence.client_type and template.tone = step.tone as matches
         from reminder_steps as step
         join reminder_sequences as sequence on sequence.id = step.sequence_id
         join templates as template on template.id = step.template_id`,
      ),
    );

    expect(rows).toHaveLength(8);
    expect(rows.every((row) => row.matches)).toBe(true);
  });

  it.each(THREAT_TERMS.map((rule) => [rule.label, rule.example] as const))(
    "la base refuse la menace « %s », comme l'application",
    async (_label, example) => {
      await expect(insertTemplate("b2b", example)).rejects.toThrow(/Modèle refusé/);
    },
  );

  it.each(B2C_FORBIDDEN_MENTIONS.map((rule) => [rule.label, rule.example] as const))(
    "la base refuse « %s » pour un particulier et l'accepte pour un professionnel",
    async (_label, example) => {
      await expect(insertTemplate("b2c", example)).rejects.toThrow(/Modèle refusé/);
      await expect(insertTemplate("b2b", example)).resolves.toBeDefined();
    },
  );

  it("accepte la mise en demeure factuelle et les mots proches des termes interdits", async () => {
    await expect(
      insertTemplate(
        "b2c",
        "Saisissez la référence. Sans règlement sous quinze jours, le dossier pourra être confié à un tiers. Montant dû : 140 €.",
      ),
    ).resolves.toBeDefined();
  });

  it("refuse une menace écrite en majuscules accentuées, avec espaces insécables ou caractère invisible", async () => {
    const nbsp = String.fromCharCode(0xa0);
    const zeroWidth = String.fromCharCode(0x200b);

    await expect(insertTemplate("b2b", "Une PROCÉDURE JUDICIAIRE sera engagée.")).rejects.toThrow(/Modèle refusé/);
    await expect(insertTemplate("b2b", `Un commissaire${nbsp}de${nbsp}justice.`)).rejects.toThrow(/Modèle refusé/);
    await expect(insertTemplate("b2b", `Un huis${zeroWidth}sier.`)).rejects.toThrow(/Modèle refusé/);
    await expect(insertTemplate("b2c", "Des PÉNALITÉS DE RETARD.")).rejects.toThrow(/Modèle refusé/);
  });

  it("refuse un terme interdit de l'interface, même en majuscules", async () => {
    await expect(insertTemplate("b2b", "Notre AGENCE vous contacte.")).rejects.toThrow(/agence/);
  });
});

describe("enregistrement des étapes d'un scénario", () => {
  let db: PGlite;
  let tenant: Tenant;
  let sequenceId: string;

  const steps = async () => {
    const { rows } = await db.query<{ id: string; position: number; offset_days: number; tone: string; template_id: string }>(
      "select id, position, offset_days, tone::text, template_id from reminder_steps where sequence_id = $1 order by position",
      [sequenceId],
    );
    return rows;
  };

  const save = (payload: unknown[]) =>
    asUser(db, tenant.userId, (tx) =>
      tx.query("select public.save_sequence_steps($1, $2)", [sequenceId, JSON.stringify(payload)]),
    );

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Scénarios");
    await db.query("select private.create_default_sequences($1)", [tenant.organizationId]);
    const { rows } = await db.query<{ id: string }>(
      "select id from reminder_sequences where organization_id = $1 and client_type = 'b2b'",
      [tenant.organizationId],
    );
    sequenceId = rows[0]?.id ?? "";
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("réordonne, modifie, ajoute et retire des étapes en gardant les identifiants existants", async () => {
    const [first, second, third] = await steps();

    await save([
      { id: first?.id, offset_days: -5, tone: "courtois" },
      { offset_days: 3, tone: "courtois" },
      { id: third?.id, offset_days: 20, tone: "ferme" },
    ]);

    const saved = await steps();
    expect(saved.map((step) => [step.position, step.offset_days, step.tone])).toEqual([
      [1, -5, "courtois"],
      [2, 3, "courtois"],
      [3, 20, "ferme"],
    ]);
    expect(saved[0]?.id).toBe(first?.id);
    expect(saved[2]?.id).toBe(third?.id);
    expect(saved.some((step) => step.id === second?.id)).toBe(false);
    expect(saved[1]?.template_id).toBe("5a4d1c3e-0b1b-4c1e-8a01-000000000101");
  });

  it.each([
    [[], /de 1 à 8 étapes/],
    [Array.from({ length: 9 }, (_, index) => ({ offset_days: index + 1, tone: "courtois" })), /de 1 à 8 étapes/],
    [[{ offset_days: 10, tone: "courtois" }, { offset_days: 5, tone: "courtois" }], /strictement croissantes/],
    [[{ offset_days: -2, tone: "ferme" }], /après l'échéance/],
    [[{ offset_days: 400, tone: "courtois" }], /hors limites/],
  ])("refuse un scénario invalide (%#)", async (payload, message) => {
    await expect(save(payload)).rejects.toThrow(message);
  });

  it("refuse un modèle pour particuliers dans un scénario pour professionnels", async () => {
    await expect(
      save([{ offset_days: 5, tone: "courtois", template_id: "5a4d1c3e-0b1b-4c1e-8a01-000000000201" }]),
    ).rejects.toThrow(/ne correspond pas au scénario/);
  });

  it("refuse un ton inconnu ou un décalage illisible avec un message clair", async () => {
    await expect(save([{ offset_days: 5, tone: "menacant" }])).rejects.toThrow(/ton inconnu/);
    await expect(save([{ offset_days: "cinq", tone: "courtois" }])).rejects.toThrow(/hors limites/);
  });

  it("ne touche ni au scénario ni aux étapes d'une autre organisation", async () => {
    const intruder = await createTenant(db, "Intrus");

    await expect(
      asUser(db, intruder.userId, (tx) =>
        tx.query("select public.save_sequence_steps($1, $2)", [sequenceId, JSON.stringify([{ offset_days: 5, tone: "courtois" }])]),
      ),
    ).rejects.toThrow(/Scénario introuvable/);

    await db.query("select private.create_default_sequences($1)", [intruder.organizationId]);
    const { rows } = await db.query<{ id: string }>(
      "select step.id from reminder_steps as step where step.organization_id = $1 limit 1",
      [intruder.organizationId],
    );
    await expect(save([{ id: rows[0]?.id, offset_days: 5, tone: "courtois" }])).rejects.toThrow(/introuvable/);
  });

  it("trace la modification du scénario", async () => {
    const { rows } = await db.query("select 1 from audit_logs where action = 'sequence.updated' and entity_id = $1", [
      sequenceId,
    ]);
    expect(rows.length).toBeGreaterThan(0);
  });
});
