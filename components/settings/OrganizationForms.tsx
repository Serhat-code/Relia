"use client";

import { useActionState } from "react";
import { updateOrganizationAction, updateRetentionAction } from "@/app/app/parametres/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { IDLE_STATE, type FormState } from "@/lib/forms/form-state";
import { RETENTION_OPTIONS } from "@/lib/organization/settings-form";

function Feedback({ state }: { state: FormState }) {
  if (state.status === "success") return <FormMessage tone="success">{state.message}</FormMessage>;
  if (state.status === "error" && state.message) return <FormMessage tone="error">{state.message}</FormMessage>;
  return null;
}

type OrganizationFormProps = { name: string; siren: string | null; canManage: boolean };

/** Nom et SIREN de l'organisation (le SIREN figure sur les relances professionnelles). */
export function OrganizationForm({ name, siren, canManage }: OrganizationFormProps) {
  const [state, formAction, isPending] = useActionState(updateOrganizationAction, IDLE_STATE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <Feedback state={state} />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Nom de l'entreprise" error={errors.name} isRequired>
          <Input name="name" defaultValue={values.name ?? name} disabled={!canManage} autoComplete="organization" />
        </Field>
        <Field label="SIREN" hint="9 chiffres, facultatif." error={errors.siren}>
          <Input name="siren" inputMode="numeric" defaultValue={values.siren ?? siren ?? ""} disabled={!canManage} />
        </Field>
      </div>
      {canManage && (
        <div className="flex justify-end">
          <Button type="submit" status={isPending ? "loading" : "idle"}>
            Enregistrer
          </Button>
        </div>
      )}
    </form>
  );
}

type RetentionFormProps = { months: number; canManage: boolean };

/** Durée de conservation des données après la clôture d'une facture (§2.2), purge automatique ensuite. */
export function RetentionForm({ months, canManage }: RetentionFormProps) {
  const [state, formAction, isPending] = useActionState(updateRetentionAction, IDLE_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Feedback state={state} />
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Conserver les données" hint="Après la clôture de la facture (payée ou annulée)." className="min-w-56">
          <Select name="retentionMonths" defaultValue={String(months)} disabled={!canManage}>
            {RETENTION_OPTIONS.map((option) => (
              <option key={option.months} value={option.months}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        {canManage && (
          <Button type="submit" variant="secondary" status={isPending ? "loading" : "idle"}>
            Enregistrer
          </Button>
        )}
      </div>
    </form>
  );
}
