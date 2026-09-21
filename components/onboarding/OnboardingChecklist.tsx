import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/button-styles";
import { cn } from "@/lib/cn";
import type { OnboardingProgress } from "@/lib/data/onboarding";
import { LoadSampleDataButton } from "./SampleData";

type Step = { title: string; description: string; isDone: boolean; href?: string; action?: string };

function steps(progress: OnboardingProgress): Step[] {
  return [
    {
      title: "Compte créé, accord de sous-traitance accepté",
      description: "Vos données sont hébergées dans l'Union européenne et cloisonnées.",
      isDone: true,
    },
    {
      title: "Connecter votre boîte d'envoi",
      description: "Vos relances partiront de votre adresse, à votre nom.",
      isDone: progress.hasActiveMailbox,
      href: "/app/boite-mail",
      action: "Connecter",
    },
    {
      title: "Importer vos premières factures",
      description: "Fichier CSV, saisie manuelle ou factures électroniques.",
      isDone: progress.hasInvoices,
      href: "/app/factures",
      action: "Importer",
    },
  ];
}

/** Prise en main en moins de 10 minutes (§5.1) : trois étapes, la prochaine mise en avant. */
export function OnboardingChecklist({ progress, canManage }: { progress: OnboardingProgress; canManage: boolean }) {
  const list = steps(progress);
  const doneCount = list.filter((step) => step.isDone).length;
  const nextIndex = list.findIndex((step) => !step.isDone);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold">Prise en main</h2>
          <p className="text-sm text-fg-muted">
            {doneCount} étape{doneCount > 1 ? "s" : ""} sur {list.length}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Avancement de la prise en main"
          aria-valuemin={0}
          aria-valuemax={list.length}
          aria-valuenow={doneCount}
          className="h-1.5 w-32 overflow-hidden rounded-full bg-surface"
        >
          <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${(doneCount / list.length) * 100}%` }} />
        </div>
      </div>
      <ol>
        {list.map((step, index) => (
          <li
            key={step.title}
            className={cn(
              "flex flex-col gap-4 border-b border-border px-6 py-5 last:border-b-0 sm:flex-row sm:items-center",
              index === nextIndex && "bg-accent-soft",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                step.isDone ? "border-success/40 bg-success/15 text-success" : "border-border text-fg-muted",
              )}
            >
              {step.isDone ? <Check className="size-3.5" /> : index + 1}
            </span>
            <div className="flex-1">
              <p className={cn("text-sm font-medium", step.isDone ? "text-fg-muted" : "text-fg")}>
                {step.title}
                {step.isDone && <span className="sr-only"> (fait)</span>}
              </p>
              <p className="text-sm text-fg-muted">{step.description}</p>
            </div>
            {!step.isDone && step.href && (
              <Link
                href={step.href}
                className={buttonClasses({ variant: index === nextIndex ? "primary" : "secondary", size: "sm" })}
              >
                {step.action}
                <ArrowRight aria-hidden />
              </Link>
            )}
          </li>
        ))}
      </ol>
      {canManage && !progress.hasInvoices && !progress.hasSampleData && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <p className="max-w-md text-sm text-fg-muted">
            Pas encore de factures sous la main ? Chargez un jeu d&apos;essai : cinq factures fictives et un client à
            votre propre adresse, pour voir Relia travailler tout de suite.
          </p>
          <LoadSampleDataButton />
        </div>
      )}
    </Card>
  );
}
