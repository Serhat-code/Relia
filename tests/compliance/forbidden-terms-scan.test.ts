import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findForbiddenTerms } from "@/lib/compliance/forbidden-terms";

/**
 * CLAUDE.md §2.1 — Relia est un outil de relance, jamais une agence de recouvrement.
 * Ce test échoue dès qu'un terme interdit apparaît dans l'interface, le marketing
 * ou les e-mails transactionnels.
 */
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCANNED_DIRS = ["app", "components", "emails", "lib"] as const;

/**
 * /lib contient aussi des textes d'interface (offres, libellés, modèles de relance). En sont exclus les
 * règles de conformité, qui nomment les termes interdits, et les tests, qui s'en servent d'exemples.
 */
const isExcluded = (relativePath: string) =>
  relativePath.startsWith(`lib${path.sep}compliance${path.sep}`) || (relativePath.startsWith(`lib${path.sep}`) && /\.test\.tsx?$/.test(relativePath));
const SCANNED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".md",
  ".mdx",
  ".json",
  ".css",
  ".html",
  ".txt",
]);

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath);
    return SCANNED_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

const scannedFiles = SCANNED_DIRS.map((dir) => path.join(ROOT, dir))
  .filter((dir) => existsSync(dir))
  .flatMap(listFiles)
  .filter((file) => !isExcluded(path.relative(ROOT, file)));

describe("vocabulaire interdit (§2.1)", () => {
  it("analyse effectivement des fichiers", () => {
    expect(scannedFiles.length).toBeGreaterThan(0);
  });

  it("balaie aussi les textes d'interface de /lib", () => {
    expect(scannedFiles.some((file) => path.relative(ROOT, file) === path.join("lib", "billing", "plans.ts"))).toBe(true);
  });

  it("aucun terme interdit dans /app, /components, /emails et /lib", () => {
    const violations = scannedFiles.flatMap((file) =>
      findForbiddenTerms(readFileSync(file, "utf8")).map(
        (match) =>
          `${path.relative(ROOT, file)}:${match.line}:${match.column} « ${match.excerpt} »`,
      ),
    );

    expect(violations).toEqual([]);
  });
});
