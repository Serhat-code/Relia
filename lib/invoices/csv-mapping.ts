import { normalizeSiren } from "@/lib/siren";
import { importRowSchema, type ImportRow } from "./import-row";
import { isAmbiguousAmount, parseAmount, parseDate } from "./parse";

export type ClientType = "b2b" | "b2c";

export type CsvFieldKey =
  | "number"
  | "debtorName"
  | "debtorSiren"
  | "debtorEmail"
  | "clientType"
  | "amountHt"
  | "amountTtc"
  | "currency"
  | "issuedAt"
  | "dueAt"
  | "paidAt";

export type CsvMapping = Partial<Record<CsvFieldKey, string>>;

type CsvField = { key: CsvFieldKey; label: string; isRequired: boolean; synonyms: readonly string[] };

/** Champs de l'assistant de correspondance, avec les intitulés courants des exports comptables. */
export const CSV_FIELDS: readonly CsvField[] = [
  { key: "number", label: "Numéro de facture", isRequired: true, synonyms: ["numero facture", "n facture", "no facture", "numero", "facture", "invoice number", "invoice", "reference", "ref"] },
  { key: "debtorName", label: "Client", isRequired: true, synonyms: ["client", "nom client", "debiteur", "raison sociale", "societe", "entreprise", "customer", "nom"] },
  { key: "debtorSiren", label: "SIREN du client", isRequired: false, synonyms: ["siren", "siret", "n siren", "numero siren"] },
  { key: "debtorEmail", label: "E-mail du client", isRequired: false, synonyms: ["email", "e mail", "mail", "courriel", "adresse email", "email client"] },
  { key: "clientType", label: "Type de client (B2B / B2C)", isRequired: false, synonyms: ["type client", "type de client", "type", "categorie"] },
  { key: "amountHt", label: "Montant HT", isRequired: false, synonyms: ["montant ht", "total ht", "ht", "hors taxes", "net"] },
  { key: "amountTtc", label: "Montant TTC", isRequired: true, synonyms: ["montant ttc", "total ttc", "ttc", "montant", "total", "net a payer", "amount"] },
  { key: "currency", label: "Devise", isRequired: false, synonyms: ["devise", "currency", "monnaie"] },
  { key: "issuedAt", label: "Date d'émission", isRequired: true, synonyms: ["date facture", "date d emission", "date emission", "emission", "date", "invoice date"] },
  { key: "dueAt", label: "Date d'échéance", isRequired: true, synonyms: ["date d echeance", "date echeance", "echeance", "due date", "date limite de paiement", "date limite"] },
  { key: "paidAt", label: "Date de règlement", isRequired: false, synonyms: ["date de paiement", "date de reglement", "date reglement", "paye le", "regle le", "payment date"] },
];

/** En-tête comparable : minuscules, sans accents ni ponctuation. */
export function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchScore(header: string, synonym: string): number {
  if (header === synonym) return 3;
  if (header.startsWith(`${synonym} `) || header.endsWith(` ${synonym}`)) return 2;
  return ` ${header} `.includes(` ${synonym} `) ? 1 : 0;
}

/** Propose une correspondance : les meilleures concordances d'abord, une colonne par champ au plus. */
export function guessMapping(headers: readonly string[]): CsvMapping {
  const candidates = CSV_FIELDS.flatMap((field) =>
    headers.flatMap((header) => {
      const normalized = normalizeHeader(header);
      const best = Math.max(0, ...field.synonyms.map((synonym) => matchScore(normalized, synonym) * 100 + synonym.length));
      return best >= 100 ? [{ key: field.key, header, score: best }] : [];
    }),
  ).sort((a, b) => b.score - a.score);

  const mapping: CsvMapping = {};
  const usedHeaders = new Set<string>();
  for (const candidate of candidates) {
    if (mapping[candidate.key] || usedHeaders.has(candidate.header)) continue;
    mapping[candidate.key] = candidate.header;
    usedHeaders.add(candidate.header);
  }
  return mapping;
}

const CLIENT_TYPE_WORDS: Readonly<Record<string, ClientType>> = {
  b2b: "b2b",
  pro: "b2b",
  professionnel: "b2b",
  entreprise: "b2b",
  societe: "b2b",
  b2c: "b2c",
  particulier: "b2c",
  prive: "b2c",
  consommateur: "b2c",
};

export function parseClientType(raw: string): ClientType | null {
  return CLIENT_TYPE_WORDS[normalizeHeader(raw)] ?? null;
}

type Reader = (key: CsvFieldKey) => string;
type Parsed<T> = { value: T | null; error?: string };

function readAmount(read: Reader, key: CsvFieldKey, label: string, isRequired: boolean): Parsed<number> {
  const raw = read(key);
  if (!raw) return { value: null, error: isRequired ? `${label} manquant.` : undefined };
  const value = parseAmount(raw);
  return value === null ? { value, error: `${label} illisible : « ${raw} ».` } : { value };
}

function readDate(read: Reader, key: CsvFieldKey, label: string, isRequired: boolean): Parsed<string> {
  const raw = read(key);
  if (!raw) return { value: null, error: isRequired ? `${label} manquante.` : undefined };
  const value = parseDate(raw);
  return value === null ? { value, error: `${label} illisible : « ${raw} ».` } : { value };
}

export type MapResult = { ok: true; row: ImportRow } | { ok: false; errors: string[] };

type MapDefaults = { clientType?: ClientType; currency?: string };

/** Transforme une ligne du CSV en facture à importer, ou liste ses erreurs en français. */
export function mapCsvRecord(record: Record<string, string>, mapping: CsvMapping, defaults: MapDefaults): MapResult {
  const read: Reader = (key) => {
    const header = mapping[key];
    return header ? (record[header] ?? "").trim() : "";
  };

  const ttc = readAmount(read, "amountTtc", "Montant TTC", true);
  const ht = read("amountHt") ? readAmount(read, "amountHt", "Montant HT", false) : { value: ttc.value };
  const issuedAt = readDate(read, "issuedAt", "Date d'émission", true);
  const dueAt = readDate(read, "dueAt", "Date d'échéance", true);
  const paidAt = readDate(read, "paidAt", "Date de règlement", false);
  const clientType = parseClientType(read("clientType")) ?? defaults.clientType ?? null;
  const siren = normalizeSiren(read("debtorSiren"));

  const errors = [
    read("number") ? undefined : "Numéro de facture manquant.",
    read("debtorName") ? undefined : "Nom du client manquant.",
    ttc.error,
    "error" in ht ? ht.error : undefined,
    issuedAt.error,
    dueAt.error,
    paidAt.error,
    clientType ? undefined : "Type de client (B2B/B2C) manquant.",
  ].filter((error): error is string => Boolean(error));
  if (errors.length > 0) return { ok: false, errors };

  const parsed = importRowSchema.safeParse({
    number: read("number"),
    debtorName: read("debtorName"),
    // Un SIRET (14 chiffres) commence par le SIREN.
    debtorSiren: siren ? siren.slice(0, 9) : null,
    debtorEmail: read("debtorEmail") || null,
    clientType,
    amountHt: ht.value,
    amountTtc: ttc.value,
    currency: (read("currency") || defaults.currency || "EUR").toUpperCase(),
    issuedAt: issuedAt.value,
    dueAt: dueAt.value,
    paidAt: paidAt.value,
    externalId: null,
    facturXRaw: null,
  });
  return parsed.success ? { ok: true, row: parsed.data } : { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
}

export type CsvEvaluation = {
  rows: ImportRow[];
  errors: Array<{ line: number; messages: string[] }>;
  missingFields: CsvFieldKey[];
  /** Montants lus comme des milliers (« 1.234 » → 1 234) : à faire confirmer avant l'import. */
  ambiguousAmounts: Array<{ line: number; raw: string; value: number }>;
};

const AMOUNT_FIELDS: readonly CsvFieldKey[] = ["amountTtc", "amountHt"];

/** Première ligne de données = ligne 2 du tableur (la ligne 1 porte les en-têtes). */
const FIRST_DATA_LINE = 2;

/** Bilan d'un fichier pour une correspondance donnée : factures prêtes, erreurs par ligne, colonnes manquantes. */
export function evaluateCsv(
  records: readonly Record<string, string>[],
  mapping: CsvMapping,
  defaults: MapDefaults,
): CsvEvaluation {
  const missingFields = CSV_FIELDS.filter((field) => field.isRequired && !mapping[field.key]).map((field) => field.key);
  const results = records.map((record) => mapCsvRecord(record, mapping, defaults));
  return {
    rows: results.flatMap((result) => (result.ok ? [result.row] : [])),
    errors: results.flatMap((result, index) =>
      result.ok ? [] : [{ line: index + FIRST_DATA_LINE, messages: result.errors }],
    ),
    missingFields,
    ambiguousAmounts: results.flatMap((result, index) => {
      if (!result.ok) return [];
      const record = records[index] ?? {};
      return AMOUNT_FIELDS.flatMap((key) => {
        const header = mapping[key];
        const raw = header ? (record[header] ?? "").trim() : "";
        const value = parseAmount(raw);
        return raw && value !== null && isAmbiguousAmount(raw) ? [{ line: index + FIRST_DATA_LINE, raw, value }] : [];
      });
    }),
  };
}
