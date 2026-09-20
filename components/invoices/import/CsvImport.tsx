"use client";

import { FileSpreadsheet, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { ChoiceCards, type Choice } from "@/components/ui/ChoiceCards";
import { Field, Select } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import type { ClientType } from "@/lib/debtors/client-type";
import { formatCurrency, formatNumber, pluralize } from "@/lib/format";
import { parseCsv, type CsvTable } from "@/lib/invoices/csv-file";
import { CSV_FIELDS, evaluateCsv, guessMapping, type CsvFieldKey, type CsvMapping } from "@/lib/invoices/csv-mapping";
import type { ImportRow } from "@/lib/invoices/import-row";
import { FileDropZone } from "./FileDropZone";
import { ImportPreview } from "./ImportPreview";

const DEFAULT_TYPE_CHOICES: readonly Choice<ClientType>[] = [
  { value: "b2b", label: "Professionnels", description: "Entreprises, associations, indépendants." },
  { value: "b2c", label: "Particuliers", description: "Relances plus espacées, sans pénalités professionnelles." },
];

/** Au-delà, la liste des erreurs se résume : le détail n'aide plus à corriger le fichier. */
const MAX_LISTED_ERRORS = 8;

type LoadedFile = { name: string; table: Extract<CsvTable, { ok: true }> };
type CsvImportProps = { isImporting: boolean; onImport: (rows: ImportRow[]) => void };

export function CsvImport({ isImporting, onImport }: CsvImportProps) {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<CsvMapping>({});
  const [defaultType, setDefaultType] = useState<ClientType | null>(null);
  const [areAmountsChecked, setAreAmountsChecked] = useState(false);

  const handleFiles = async ([selected]: File[]) => {
    if (!selected) return;
    const table = parseCsv(new Uint8Array(await selected.arrayBuffer()));
    if (!table.ok) {
      setReadError(table.error);
      return;
    }
    setReadError(null);
    setFile({ name: selected.name, table });
    setMapping(guessMapping(table.headers));
    setAreAmountsChecked(false);
  };

  const evaluation = useMemo(
    () => (file ? evaluateCsv(file.table.records, mapping, { clientType: defaultType ?? undefined }) : null),
    [file, mapping, defaultType],
  );

  if (!file || !evaluation) {
    return (
      <div className="flex flex-col gap-4">
        {readError && <FormMessage tone="error">{readError}</FormMessage>}
        <FileDropZone
          label="Choisir un fichier CSV"
          hint="Ou glissez-le ici. Export de votre logiciel de facturation ou de votre tableur, 2 000 factures au plus."
          accept=".csv,text/csv"
          onFiles={handleFiles}
        />
      </div>
    );
  }

  const setColumn = (key: CsvFieldKey, header: string) => setMapping((current) => ({ ...current, [key]: header || undefined }));
  const hasTypeColumn = Boolean(mapping.clientType);
  const missingLabels = CSV_FIELDS.filter((field) => evaluation.missingFields.includes(field.key)).map((field) => field.label);
  const readyCount = evaluation.rows.length;
  const ambiguous = evaluation.ambiguousAmounts;
  const needsAmountCheck = ambiguous.length > 0 && !areAmountsChecked;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2.5 text-sm">
          <FileSpreadsheet aria-hidden className="size-4 shrink-0 text-link" />
          <span className="truncate font-medium">{file.name}</span>
          <span className="text-fg-muted">
            · {formatNumber(file.table.records.length)} {pluralize(file.table.records.length, "ligne", "lignes")}
          </span>
        </span>
        <Button variant="ghost" size="sm" icon={<RotateCcw aria-hidden />} onClick={() => setFile(null)} disabled={isImporting}>
          Changer de fichier
        </Button>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="csv-colonnes">
        <div className="flex flex-col gap-1">
          <h2 id="csv-colonnes" className="text-base font-semibold">
            Colonnes du fichier
          </h2>
          <p className="text-sm text-fg-muted">Relia a reconnu ce qu&apos;il a pu. Vérifiez chaque correspondance.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CSV_FIELDS.map((field) => (
            <Field key={field.key} label={field.label} isRequired={field.isRequired}>
              <Select value={mapping[field.key] ?? ""} onChange={(event) => setColumn(field.key, event.target.value)}>
                <option value="">— Aucune colonne —</option>
                {file.table.headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </div>
      </section>

      <ChoiceCards
        name="defaultClientType"
        legend={hasTypeColumn ? "Quand la colonne « type de client » est vide, ces factures concernent des…" : "Ces factures concernent des…"}
        choices={DEFAULT_TYPE_CHOICES}
        value={defaultType}
        onChange={setDefaultType}
        isRequired={!hasTypeColumn}
      />

      <section className="flex flex-col gap-4" aria-labelledby="csv-apercu" aria-live="polite">
        <h2 id="csv-apercu" className="text-base font-semibold">
          Vérification
        </h2>
        {missingLabels.length > 0 ? (
          <FormMessage tone="error">Associez les colonnes obligatoires : {missingLabels.join(", ")}.</FormMessage>
        ) : (
          <>
            <FormMessage tone={readyCount > 0 ? "success" : "error"}>
              {formatNumber(readyCount)} {pluralize(readyCount, "facture prête", "factures prêtes")} à importer
              {evaluation.errors.length > 0 &&
                ` · ${formatNumber(evaluation.errors.length)} ${pluralize(evaluation.errors.length, "ligne ignorée", "lignes ignorées")} (voir ci-dessous)`}
              .
            </FormMessage>
            {evaluation.errors.length > 0 && (
              <ul className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface/40 p-4 text-sm">
                {evaluation.errors.slice(0, MAX_LISTED_ERRORS).map((error) => (
                  <li key={error.line}>
                    <span className="font-medium tabular-nums">Ligne {error.line}</span>
                    <span className="text-fg-muted"> : {error.messages.join(" ")}</span>
                  </li>
                ))}
                {evaluation.errors.length > MAX_LISTED_ERRORS && (
                  <li className="text-fg-muted">
                    Et {formatNumber(evaluation.errors.length - MAX_LISTED_ERRORS)} autres lignes.
                  </li>
                )}
              </ul>
            )}
            {ambiguous.length > 0 && (
              <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/8 p-4 text-sm">
                <p className="font-medium text-fg">
                  {formatNumber(ambiguous.length)} {pluralize(ambiguous.length, "montant à vérifier", "montants à vérifier")} :
                  un séparateur suivi de trois chiffres est lu comme un séparateur de milliers.
                </p>
                <ul className="flex flex-col gap-1">
                  {ambiguous.slice(0, MAX_LISTED_ERRORS).map((item) => (
                    <li key={`${item.line}-${item.raw}`} className="text-fg-muted">
                      <span className="font-medium text-fg tabular-nums">Ligne {item.line}</span> : « {item.raw} » lu{" "}
                      <span className="font-medium text-fg tabular-nums">{formatCurrency(item.value)}</span>
                    </li>
                  ))}
                  {ambiguous.length > MAX_LISTED_ERRORS && (
                    <li className="text-fg-muted">Et {formatNumber(ambiguous.length - MAX_LISTED_ERRORS)} autres.</li>
                  )}
                </ul>
                <CheckboxField
                  name="amountsChecked"
                  label="J&apos;ai vérifié ces montants : ils sont bien lus."
                  checked={areAmountsChecked}
                  onCheckedChange={setAreAmountsChecked}
                />
              </div>
            )}
            {readyCount > 0 && <ImportPreview rows={evaluation.rows} />}
          </>
        )}
      </section>

      <div className="flex justify-end border-t border-border pt-6">
        <Button
          size="lg"
          status={isImporting ? "loading" : "idle"}
          loadingLabel="Import…"
          disabled={readyCount === 0 || missingLabels.length > 0 || needsAmountCheck}
          onClick={() => onImport(evaluation.rows)}
        >
          Importer {formatNumber(readyCount)} {pluralize(readyCount, "facture", "factures")}
        </Button>
      </div>
    </div>
  );
}
