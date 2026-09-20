"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { Field, Input } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { IDLE_FORM_STATE } from "@/lib/auth/form-state";
import { DPA_VERSION } from "@/lib/legal/dpa";
import { signUpAction } from "../actions";
import { CheckEmailPanel } from "./CheckEmailPanel";

function DpaLabel() {
  return (
    <>
      J&apos;accepte les{" "}
      <Link href="/cgu" target="_blank" rel="noopener noreferrer" className="font-medium text-link underline-offset-4 hover:underline">
        conditions générales
      </Link>{" "}
      et l&apos;
      <Link
        href="/dpa"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-link underline-offset-4 hover:underline"
      >
        accord de sous-traitance des données (DPA, article 28 du RGPD)
      </Link>
      , version {DPA_VERSION}.
    </>
  );
}

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUpAction, IDLE_FORM_STATE);
  if (state.status === "check-email") return <CheckEmailPanel message={state.message} />;

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}

      <Field label="Votre nom" error={errors.fullName} isRequired>
        <Input name="fullName" autoComplete="name" defaultValue={values.fullName} autoFocus />
      </Field>
      <Field label="Entreprise" error={errors.organizationName} isRequired>
        <Input name="organizationName" autoComplete="organization" defaultValue={values.organizationName} />
      </Field>
      <Field label="SIREN" hint="Facultatif. 9 chiffres." error={errors.siren}>
        <Input name="siren" inputMode="numeric" defaultValue={values.siren} className="tabular-nums" />
      </Field>
      <Field label="Adresse e-mail professionnelle" error={errors.email} isRequired>
        <Input name="email" type="email" autoComplete="email" defaultValue={values.email} />
      </Field>
      <Field label="Mot de passe" hint="10 caractères minimum, avec au moins une lettre et un chiffre." error={errors.password} isRequired>
        <PasswordInput name="password" autoComplete="new-password" />
      </Field>

      <CheckboxField
        name="dpaAccepted"
        label={<DpaLabel />}
        error={errors.dpaAccepted}
        defaultChecked={values.dpaAccepted === "on"}
      />

      <Button type="submit" size="lg" status={isPending ? "loading" : "idle"} loadingLabel="Création du compte…">
        Créer mon compte
      </Button>
      <p className="text-xs text-fg-muted">14 jours d&apos;essai gratuit, sans carte bancaire.</p>
    </form>
  );
}
