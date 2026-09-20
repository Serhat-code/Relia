"use client";

import { FileCode2, FileWarning, X } from "lucide-react";
import { useState } from "react";
import { ReliaLoader } from "@/components/brand/ReliaLoader";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { CLIENT_TYPE_LABELS, type ClientType } from "@/lib/debtors/client-type";
import { formatCurrency, formatDate, formatNumber, pluralize } from "@/lib/format";
import type { FacturXResult } from "@/lib/invoices/facturx";
import type { ImportRow } from "@/lib/invoices/import-row";
import { FileDropZone } from "./FileDropZone";

/** Au-delà, mieux vaut un export CSV : la lecture se fait fichier par fichier dans le navigateur. */
const MAX_FILES = 50;

type ReadFile = { key: string; name: string; result: FacturXResult };

/** Lecture dans le navigateur : le PDF ne quitte pas le poste, seules les données de la facture sont envoyées. */
async function readFiles(files: readonly File[]): Promise<ReadFile[]> {
  const { readFacturX } = await import("@/lib/invoices/facturx");
  return Promise.all(
    files.map(async (file, index) => ({
      key: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      result: await readFacturX(new Uint8Array(await file.arrayBuffer()), file.name),
    })),
  );
}

type FacturXImportProps = { isImporting: boolean; onImport: (rows: ImportRow[]) => void };

export function FacturXImport({ isImporting, onImport }: FacturXImportProps) {
  const [files, setFiles] = useState<ReadFile[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleFiles = async (selected: File[]) => {
    const room = MAX_FILES - files.length;
    setNotice(selected.length > room ? `${MAX_FILES} fichiers au plus par import : les suivants ont été laissés de côté.` : null);
    setIsReading(true);
    try {
      const read = await readFiles(selected.slice(0, Math.max(0, room)));
      setFiles((current) => [...current, ...read]);
    } finally {
      setIsReading(false);
    }
  };

  const setClientType = (key: string, clientType: ClientType) =>
    setFiles((current) =>
      current.map((file) =>
        file.key === key && file.result.ok ? { ...file, result: { ...file.result, row: { ...file.result.row, clientType } } } : file,
      ),
    );

  const ready = files.flatMap((file) => (file.result.ok ? [file.result.row] : []));

  return (
    <div className="flex flex-col gap-6">
      {notice && <FormMessage tone="info">{notice}</FormMessage>}
      <FileDropZone
        label="Choisir des factures Factur-X"
        hint="PDF Factur-X ou XML (syntaxe CII), jusqu'à 10 Mo chacun. Les fichiers sont lus sur votre poste."
        accept=".pdf,.xml,application/pdf,text/xml,application/xml"
        isMultiple
        isDisabled={isReading || isImporting}
        onFiles={handleFiles}
      />
      {isReading && (
        <div className="flex items-center gap-3 text-sm text-fg-muted" role="status">
          <ReliaLoader size="md" isDecorative />
          Lecture des factures…
        </div>
      )}

      {files.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {files.map((file) => (
            <li key={file.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              {file.result.ok ? (
                <FileCode2 aria-hidden className="size-4 shrink-0 text-link" />
              ) : (
                <FileWarning aria-hidden className="size-4 shrink-0 text-danger" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {file.result.ok ? (
                  <>
                    <span className="truncate text-sm font-medium">
                      {file.result.row.number} · {file.result.row.debtorName}
                    </span>
                    <span className="text-xs text-fg-muted tabular-nums">
                      {formatCurrency(file.result.row.amountTtc, file.result.row.currency)} · échéance{" "}
                      {formatDate(file.result.row.dueAt)} · {file.name}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="truncate text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-danger">{file.result.error}</span>
                  </>
                )}
              </div>
              {file.result.ok && (
                <select
                  aria-label={`Type de client pour ${file.result.row.number}`}
                  value={file.result.row.clientType}
                  onChange={(event) => setClientType(file.key, event.target.value === "b2c" ? "b2c" : "b2b")}
                  className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-fg"
                >
                  {(["b2b", "b2c"] as const).map((type) => (
                    <option key={type} value={type}>
                      {CLIENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => setFiles((current) => current.filter((item) => item.key !== file.key))}
                aria-label={`Retirer ${file.name}`}
                disabled={isImporting}
                className="inline-flex size-8 items-center justify-center rounded-lg text-fg-muted transition duration-hover hover:bg-surface hover:text-fg"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <div className="flex justify-end border-t border-border pt-6">
          <Button
            size="lg"
            status={isImporting ? "loading" : "idle"}
            loadingLabel="Import…"
            disabled={ready.length === 0 || isReading}
            onClick={() => onImport(ready)}
          >
            Importer {formatNumber(ready.length)} {pluralize(ready.length, "facture", "factures")}
          </Button>
        </div>
      )}
    </div>
  );
}
