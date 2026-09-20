"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { IDLE_FORM_STATE } from "@/lib/auth/form-state";
import { forgotPasswordAction, resetPasswordAction } from "../actions";
import { CheckEmailPanel } from "./CheckEmailPanel";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, IDLE_FORM_STATE);
  if (state.status === "check-email") return <CheckEmailPanel message={state.message} />;

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <Field label="Adresse e-mail" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" defaultValue={values.email} autoFocus />
      </Field>
      <Button type="submit" size="lg" status={isPending ? "loading" : "idle"} loadingLabel="Envoi…">
        Recevoir un lien
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <Field label="Nouveau mot de passe" hint="10 caractères minimum, avec au moins une lettre et un chiffre." error={errors.password}>
        <PasswordInput name="password" autoComplete="new-password" autoFocus />
      </Field>
      <Field label="Confirmation" error={errors.confirmation}>
        <PasswordInput name="confirmation" autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" status={isPending ? "loading" : "idle"} loadingLabel="Enregistrement…">
        Enregistrer le mot de passe
      </Button>
    </form>
  );
}
