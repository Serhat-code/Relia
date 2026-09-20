// Usage : npm run db:types:local — écrit lib/supabase/database.types.ts depuis les migrations (sans Docker).
import { writeFileSync } from "node:fs";
import { createDatabase } from "../tests/db/database.ts";
import { renderDatabaseTypes } from "./db-types.ts";

const OUTPUT = new URL("../lib/supabase/database.types.ts", import.meta.url);

const db = await createDatabase();
try {
  writeFileSync(OUTPUT, await renderDatabaseTypes(db));
  console.warn(`Types écrits dans ${OUTPUT.pathname}`);
} finally {
  await db.close();
}
