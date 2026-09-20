import Papa from "papaparse";
import { MAX_IMPORT_ROWS } from "./import-row";

/** Lecture d'un fichier CSV dans le navigateur : rien n'est envoyé avant la confirmation de l'import. */

export const MAX_CSV_BYTES = 5 * 1024 * 1024;

export type CsvTable = { ok: true; headers: string[]; records: Record<string, string>[] } | { ok: false; error: string };

/** UTF-8 si possible, sinon Windows-1252 (exports Excel « CSV (séparateur : point-virgule) »). */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function parseCsv(bytes: Uint8Array): CsvTable {
  if (bytes.byteLength > MAX_CSV_BYTES) return { ok: false, error: "Ce fichier dépasse 5 Mo." };
  const text = decodeText(bytes);
  if (text.trim() === "") return { ok: false, error: "Ce fichier est vide." };

  const parsed = Papa.parse<Record<string, string | undefined>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  const headers = (parsed.meta.fields ?? []).filter((header) => header !== "");
  if (headers.length === 0) return { ok: false, error: "Ce fichier ne contient pas de ligne d'en-têtes." };
  if (parsed.data.length === 0) return { ok: false, error: "Ce fichier ne contient aucune facture." };
  if (parsed.data.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `Ce fichier compte ${parsed.data.length} lignes : ${MAX_IMPORT_ROWS} au maximum par import. Découpez-le en plusieurs fichiers.`,
    };
  }

  const records = parsed.data.map((record) =>
    Object.fromEntries(headers.map((header) => [header, (record[header] ?? "").trim()])),
  );
  return { ok: true, headers, records };
}
