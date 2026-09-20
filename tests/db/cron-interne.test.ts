import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_TEST_TIMEOUT_MS, createDatabase } from "./database";

/**
 * Tâches planifiées déclenchées par la base (pg_cron), faute de crons fréquents sur Vercel Hobby.
 * Les horaires doivent rester ceux du §9 et le secret ne doit jamais être exigé au déploiement.
 */
describe("cron interne", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDatabase();
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("planifie les quatre tâches du §9, aux horaires attendus", async () => {
    const { rows } = await db.query<{ jobname: string; schedule: string; command: string }>(
      "select jobname, schedule, command from cron.job order by jobname",
    );

    expect(rows.map((job) => [job.jobname, job.schedule])).toEqual([
      ["relia-purge", "0 4 * * 0"],
      ["relia-relances-envoyer", "*/15 * * * *"],
      ["relia-relances-preparer", "0 7 * * *"],
      ["relia-reponses", "*/30 * * * *"],
    ]);
    expect(rows.every((job) => job.command.includes("private.call_cron_endpoint"))).toBe(true);
  });

  it("n'appelle rien tant que l'URL et le secret ne sont pas renseignés", async () => {
    const { rows } = await db.query<{ id: number | null }>("select private.call_cron_endpoint('/api/cron/purge') as id");

    expect(rows[0]?.id).toBeNull();
    expect((await db.query("select * from net.sent_requests")).rows).toHaveLength(0);
  });

  it("appelle la route avec le secret partagé, une fois les deux secrets posés", async () => {
    await db.query("select vault.create_secret('https://relia.example/', 'relia_cron_base_url')");
    await db.query("select vault.create_secret('jeton-de-cron', 'relia_cron_secret')");

    await db.query("select private.call_cron_endpoint('/api/cron/relances/envoyer')");

    const { rows } = await db.query<{ url: string; headers: { Authorization: string } }>(
      "select url, headers from net.sent_requests",
    );
    // La barre oblique en trop de l'URL de base ne doit pas se retrouver dans l'adresse appelée.
    expect(rows[0]?.url).toBe("https://relia.example/api/cron/relances/envoyer");
    expect(rows[0]?.headers.Authorization).toBe("Bearer jeton-de-cron");
  });
});
