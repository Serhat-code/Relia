"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { saveStepsAction } from "@/app/app/scenarios/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { useToast } from "@/components/ui/toast/ToastProvider";
import {
  MAX_OFFSET_DAYS,
  MAX_STEPS,
  MIN_OFFSET_DAYS,
  REMINDER_TONES,
  describeOffset,
  validateSteps,
  type StepDraft,
} from "@/lib/sequences/steps";
import { REMINDER_TONE_LABELS, type ReminderTone } from "@/lib/templates/system-templates";
import { SequenceTimeline } from "./SequenceTimeline";

type TemplateOption = { id: string; name: string; tone: ReminderTone; isSystem: boolean };

type StepEditorProps = {
  sequenceId: string;
  initialSteps: readonly StepDraft[];
  templates: readonly TemplateOption[];
};

/** Jours ajoutés après la dernière étape quand on en crée une nouvelle. */
const NEW_STEP_GAP_DAYS = 7;

let nextKey = 0;
const withKey = (step: StepDraft) => ({ ...step, key: step.id ?? `nouvelle-${++nextKey}` });

export function StepEditor({ sequenceId, initialSteps, templates }: StepEditorProps) {
  const [steps, setSteps] = useState(() => initialSteps.map(withKey));
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const messagesId = useId();
  const validation = validateSteps(steps);
  const stepErrors = validation.ok ? {} : validation.stepErrors;

  const update = (key: string, patch: Partial<StepDraft>) =>
    setSteps((current) => current.map((step) => (step.key === key ? { ...step, ...patch } : step)));

  const changeTone = (key: string, tone: ReminderTone) => {
    // Un modèle d'un autre ton ne convient plus : retour au modèle Relia du nouveau ton.
    const step = steps.find((item) => item.key === key);
    const template = templates.find((item) => item.id === step?.templateId);
    update(key, { tone, templateId: template && template.tone === tone ? template.id : null });
  };

  const addStep = () => {
    const last = steps.at(-1);
    const offsetDays = Math.min(MAX_OFFSET_DAYS, (last?.offsetDays ?? 0) + NEW_STEP_GAP_DAYS);
    setSteps((current) => [...current, withKey({ id: null, offsetDays, tone: last?.tone ?? "courtois", templateId: null })]);
  };

  const save = () => {
    if (!validation.ok) {
      setServerError(validation.message);
      return;
    }
    setServerError(null);
    startTransition(async () => {
      const result = await saveStepsAction({
        sequenceId,
        steps: steps.map(({ id, offsetDays, tone, templateId }) => ({ id, offsetDays, tone, templateId })),
      });
      if (result.ok) toast.show({ tone: "success", title: "Scénario enregistré." });
      else setServerError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <SequenceTimeline steps={steps} />

      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const toneTemplates = templates.filter((template) => template.tone === step.tone && !template.isSystem);
          const error = stepErrors[index];
          return (
            <li
              key={step.key}
              className="grid gap-4 rounded-xl border border-border bg-surface/40 p-4 sm:grid-cols-[auto_1fr_1fr_1.4fr_auto] sm:items-start"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-link tabular-nums">
                {index + 1}
              </span>
              <Field
                label="Jours / échéance"
                hint={Number.isFinite(step.offsetDays) ? describeOffset(step.offsetDays) : undefined}
                error={error}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={MIN_OFFSET_DAYS}
                  max={MAX_OFFSET_DAYS}
                  value={Number.isFinite(step.offsetDays) ? step.offsetDays : ""}
                  onChange={(event) => update(step.key, { offsetDays: Number.parseInt(event.target.value, 10) })}
                  className="tabular-nums"
                />
              </Field>
              <Field label="Ton">
                <Select value={step.tone} onChange={(event) => changeTone(step.key, event.target.value as ReminderTone)}>
                  {REMINDER_TONES.map((tone) => (
                    <option key={tone} value={tone}>
                      {REMINDER_TONE_LABELS[tone]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Modèle">
                <Select
                  value={step.templateId ?? ""}
                  onChange={(event) => update(step.key, { templateId: event.target.value || null })}
                >
                  <option value="">Modèle Relia</option>
                  {toneTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                variant="ghost"
                size="sm"
                className="sm:mt-7"
                aria-label={`Retirer l'étape ${index + 1}`}
                disabled={steps.length === 1}
                onClick={() => setSteps((current) => current.filter((item) => item.key !== step.key))}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          );
        })}
      </ol>

      <div id={messagesId}>
        {!validation.ok && Object.keys(stepErrors).length === 0 && <FormMessage tone="error">{validation.message}</FormMessage>}
        {serverError && <FormMessage tone="error">{serverError}</FormMessage>}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
        <Button variant="secondary" icon={<Plus aria-hidden />} onClick={addStep} disabled={steps.length >= MAX_STEPS}>
          Ajouter une étape
        </Button>
        <Button
          status={isPending ? "loading" : "idle"}
          loadingLabel="Enregistrement…"
          aria-describedby={validation.ok ? undefined : messagesId}
          onClick={save}
        >
          Enregistrer le scénario
        </Button>
      </div>
    </div>
  );
}
