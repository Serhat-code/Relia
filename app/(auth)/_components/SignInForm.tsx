"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { IDLE_FORM_STATE } from "@/lib/auth/form-state";
import { signInAction } from "../actions";

export function SignInForm({ next, notice }: { next: string; notice?: string }) {
  const [state, formAction, isPending] = useActionState(signInAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {notice && state.status === "idle" && <FormMessage tone="error">{notice}</FormMessage>}
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <input type="hidden" name="next" value={next} />

      <Field label="Adresse e-mail" error={errors.email}>
        <Input name="email" type="email" autoComplete="email" defaultValue={values.email} autoFocus />
      </Field>

      <Field label="Mot de passe" error={errors.password}>
        <PasswordInput name="password" autoComplete="current-password" />
      </Field>

      <Link
        href="/mot-de-passe-oublie"
        className="-mt-2 w-fit text-sm font-medium text-link underline-offset-4 hover:underline"
      >
        Mot de passe oublié ?
      </Link>

      <Button type="submit" size="lg" status={isPending ? "loading" : "idle"} loadingLabel="Connexion…">
        Se connecter
      </Button>
    </form>
  );
}
