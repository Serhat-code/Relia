import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, asService, asUser, createDatabase } from "./database";

/** Inscription (palier 5) : l'organisation est créée d'un bloc, par le serveur. */
describe("provisionnement d'une organisation à l'inscription", () => {
  let db: PGlite;
  const userId = crypto.randomUUID();

  const provision = (organizationName = "Atelier Nouveau") =>
    asService(db, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `select public.provision_organization($1, $2, $3, $4, $5, $6, $7) as id`,
        [userId, "fondatrice@atelier.example", "Nina Fondatrice", organizationName, "900000301", "2026-09", "203.0.113.7"],
      );
      return rows[0]?.id ?? "";
    });

  beforeAll(async () => {
    db = await createDatabase();
    await db.query("insert into auth.users (id, email) values ($1, 'fondatrice@atelier.example')", [userId]);
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("crée l'organisation avec l'acceptation du DPA (horodatage, version, IP)", async () => {
    const organizationId = await provision();

    const { rows } = await db.query<{ name: string; dpa_version: string; dpa_ip: string; accepted: boolean }>(
      `select name, dpa_version, host(dpa_ip) as dpa_ip, dpa_accepted_at is not null as accepted
       from organizations where id = $1`,
      [organizationId],
    );
    expect(rows[0]).toEqual({ name: "Atelier Nouveau", dpa_version: "2026-09", dpa_ip: "203.0.113.7", accepted: true });
  });

  it("rattache l'utilisateur comme propriétaire", async () => {
    const { rows } = await db.query<{ role: string; full_name: string }>(
      "select role::text, full_name from users where id = $1",
      [userId],
    );

    expect(rows[0]).toEqual({ role: "owner", full_name: "Nina Fondatrice" });
  });

  it("fournit les scénarios par défaut B2B et B2C, quatre étapes chacun, B2C plus patient", async () => {
    const { rows } = await asUser(db, userId, (tx) =>
      tx.query<{ client_type: string; offsets: number[] }>(
        `select sequence.client_type::text, array_agg(step.offset_days order by step.position) as offsets
         from reminder_sequences as sequence
         join reminder_steps as step on step.sequence_id = sequence.id
         where sequence.is_default
         group by sequence.client_type order by 1`,
      ),
    );

    expect(rows).toEqual([
      { client_type: "b2b", offsets: [-3, 7, 15, 30] },
      { client_type: "b2c", offsets: [-3, 10, 25, 45] },
    ]);
  });

  it("trace la création et l'acceptation du DPA dans le journal d'audit", async () => {
    const { rows } = await asUser(db, userId, (tx) =>
      tx.query<{ action: string }>("select action from audit_logs order by id"),
    );

    expect(rows.map((row) => row.action)).toEqual(["organization.created", "dpa.accepted"]);
  });

  it("une nouvelle tentative ne crée pas de doublon", async () => {
    const first = await db.query<{ organization_id: string }>("select organization_id from users where id = $1", [
      userId,
    ]);

    const again = await provision("Doublon");

    expect(again).toBe(first.rows[0]?.organization_id);
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from organizations");
    expect(rows[0]?.n).toBe(1);
  });

  it("n'est accessible qu'au serveur (clé de service)", async () => {
    await expect(
      asUser(db, userId, (tx) =>
        tx.query("select public.provision_organization($1, 'a@b.fr', '', 'X', null, 'v', '1.1.1.1')", [userId]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
