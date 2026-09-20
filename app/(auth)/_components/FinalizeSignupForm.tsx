"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { Field, Input } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { IDLE_FORM_STATE } from "@/lib/auth/form-state";
import { DPA_VERSION } from "@/lib/legal/dpa";
import { finalizeSignupAction } from "../actions";

export function FinalizeSignupForm() {
  const [state, formAction, isPending] = useActionState(finalizeSignupAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <Field label="Entreprise" error={errors.organizationName} isRequired>
        <Input name="organizationName" autoComplete="organization" defaultValue={values.organizationName} autoFocus />
      </Field>
      <Field label="SIREN" hint="Facultatif. 9 chiffres." error={errors.siren}>
        <Input name="siren" inputMode="numeric" defaultValue={values.siren} className="tabular-nums" />
      </Field>
      <CheckboxField
        name="dpaAccepted"
        error={errors.dpaAccepted}
        defaultChecked={values.dpaAccepted === "on"}
        label={
          <>
            J&apos;accepte l&apos;
            <Link href="/dpa" target="_blank" rel="noopener noreferrer" className="font-medium text-link underline-offset-4 hover:underline">
              accord de sous-traitance des données (DPA)
            </Link>
            , version {DPA_VERSION}.
          </>
        }
      />
      <Button type="submit" size="lg" status={isPending ? "loading" : "idle"} loadingLabel="Création…">
        Accéder à Relia
      </Button>
    </form>
  );
}
