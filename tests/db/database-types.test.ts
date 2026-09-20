import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderDatabaseTypes } from "../../scripts/db-types";
import { DB_TEST_TIMEOUT_MS, createDatabase } from "./database";

describe("types TypeScript de la base", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDatabase();
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  it("lib/supabase/database.types.ts est à jour avec les migrations (sinon : npm run db:types:local)", async () => {
    const committed = readFileSync(new URL("../../lib/supabase/database.types.ts", import.meta.url), "utf8");

    expect(committed).toBe(await renderDatabaseTypes(db));
  });
});
