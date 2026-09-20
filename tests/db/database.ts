import { readFileSync, readdirSync } from "node:fs";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

/**
 * Base PostgreSQL de test (PGlite) : imitation de Supabase, puis les vraies migrations
 * de supabase/migrations, dans l'ordre. Aucune dépendance à Docker.
 */
const ROOT = new URL("../../", import.meta.url);
const readProjectFile = (path: string) => readFileSync(new URL(path, ROOT), "utf8");

/** Les tests de base de données démarrent un PostgreSQL complet : on leur laisse le temps. */
export const DB_TEST_TIMEOUT_MS = 60_000;

export function migrationFiles(): string[] {
  return readdirSync(new URL("supabase/migrations/", ROOT))
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

export async function createDatabase({ withSeed = false }: { withSeed?: boolean } = {}): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(readProjectFile("tests/db/supabase-shim.sql"));
  for (const file of migrationFiles()) {
    await db.exec(readProjectFile(`supabase/migrations/${file}`));
  }
  if (withSeed) await db.exec(readProjectFile("supabase/seed.sql"));
  return db;
}

type ApiRole = "anon" | "authenticated" | "service_role";

/** Exécute `run` comme le ferait l'API Supabase pour ce rôle (et cet utilisateur), dans une transaction. */
async function asRole<T>(
  db: PGlite,
  role: ApiRole,
  userId: string | null,
  run: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role })]);
    await tx.exec(`set local role ${role}`);
    return run(tx);
  });
}

export const asUser = <T>(db: PGlite, userId: string, run: (tx: Transaction) => Promise<T>) =>
  asRole(db, "authenticated", userId, run);

export const asAnon = <T>(db: PGlite, run: (tx: Transaction) => Promise<T>) => asRole(db, "anon", null, run);

export const asService = <T>(db: PGlite, run: (tx: Transaction) => Promise<T>) =>
  asRole(db, "service_role", null, run);
