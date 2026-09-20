"use client";

import { FileCode2, FileSpreadsheet } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { importInvoicesAction } from "@/app/app/factures/actions";
import { ReliaLoader } from "@/components/brand/ReliaLoader";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/button-styles";
import { FormMessage } from "@/components/ui/FormMessage";
import { cn } from "@/lib/cn";
import type { ImportSummary } from "@/lib/data/invoices";
import { DURATION } from "@/lib/design/motion";
import { formatNumber, pluralize } from "@/lib/format";
import type { ImportRow } from "@/lib/invoices/import-row";
import { CsvImport } from "./CsvImport";
import { FacturXImport } from "./FacturXImport";

type Mode = "csv" | "facturx";

const MODES = [
  { value: "csv", label: "Fichier CSV", icon: FileSpreadsheet },
  { value: "facturx", label: "Factures électroniques", icon: FileCode2 },
] as const;

/** Nombre de numéros ignorés affichés ; au-delà, un simple compte suffit. */
const MAX_LISTED_SKIPPED = 5;

function SummaryText({ summary }: { summary: ImportSummary }) {
  const skipped = summary.skipped.length;
  return (
    <div className="flex flex-col gap-1 text-center">
      <p className="text-lg font-semibold">
        {formatNumber(summary.created)} {pluralize(summary.created, "facture importée", "factures importées")}
      </p>
      <p className="text-sm text-fg-muted">
        {summary.debtorsCreated > 0 &&
          `${formatNumber(summary.debtorsCreated)} ${pluralize(summary.debtorsCreated, "nouveau client ajouté", "nouveaux clients ajoutés")}. `}
        {skipped > 0 &&
          `${formatNumber(skipped)} ${pluralize(skipped, "numéro déjà présent, ignoré", "numéros déjà présents, ignorés")} : ${summary.skipped.slice(0, MAX_LISTED_SKIPPED).join(", ")}${skipped > MAX_LISTED_SKIPPED ? "…" : ""}.`}
      </p>
    </div>
  );
}

export function ImportWizard() {
  const [mode, setMode] = useState<Mode>("csv");
  const [isImporting, startImport] = useTransition();
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const runImport = (rows: ImportRow[]) => {
    setError(null);
    startImport(async () => {
      const result = await importInvoicesAction({ source: mode, rows });
      if (result.ok) setSummary(result.summary);
      else setError(result.error);
    });
  };

  const restart = () => {
    setSummary(null);
    setAttempt((value) => value + 1);
  };

  if (isImporting || summary) {
    return (
      <div className="flex flex-col items-center gap-5 py-10" role="status" aria-live="polite">
        <ReliaLoader size="lg" state={summary ? "success" : "loading"} label={summary ? "Import terminé" : "Import en cours…"} hasFaviconAnimation />
        {summary ? (
          <>
            <SummaryText summary={summary} />
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="secondary" onClick={restart}>
                Importer d&apos;autres factures
              </Button>
              <Link href="/app/factures" className={buttonClasses()}>
                Voir les factures
              </Link>
            </div>
          </>
        ) : (
          <p className="text-sm text-fg-muted">Import en cours…</p>
        )}
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-6">
        <div role="tablist" aria-label="Type de fichier" className="flex w-fit gap-1 rounded-xl border border-border bg-surface/50 p-1">
          {MODES.map(({ value, label, icon: Icon }) => {
            const isActive = mode === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setMode(value)}
                className={cn(
                  "relative flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors duration-hover",
                  isActive ? "text-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="import-mode"
                    aria-hidden
                    className="absolute inset-0 rounded-lg border border-glow bg-elevated shadow-raised"
                    transition={{ type: "spring", visualDuration: DURATION.enter, bounce: 0.15 }}
                  />
                )}
                <Icon aria-hidden className="relative size-4" />
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <div role="tabpanel" key={`${mode}-${attempt}`}>
          {mode === "csv" ? (
            <CsvImport isImporting={isImporting} onImport={runImport} />
          ) : (
            <FacturXImport isImporting={isImporting} onImport={runImport} />
          )}
        </div>
      </div>
    </MotionConfig>
  );
}
