"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { connectSmtpAction } from "@/app/app/boite-mail/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { IDLE_STATE } from "@/lib/forms/form-state";
import { SMTP_PRESETS } from "@/lib/mail/smtp-form";
import { IMAP_PORT } from "@/lib/mail/smtp-ports";

/**
 * Repli SMTP : la messagerie du client, avec ses propres identifiants (chiffrés dans Vault). Le
 * serveur IMAP, facultatif, permet à Relia de lire les réponses de ses clients.
 */
/** Laisse le temps de lire la confirmation avant de renvoyer au tableau de bord. */
const REDIRECT_DELAY_MS = 2000;

export function SmtpForm({ defaultSenderName }: { defaultSenderName: string }) {
  const [state, formAction, isPending] = useActionState(connectSmtpAction, IDLE_STATE);
  const router = useRouter();
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const [host, setHost] = useState(values.host ?? "");
  const [port, setPort] = useState(values.port ?? "465");
  const [imapHost, setImapHost] = useState(values.imapHost ?? "");

  // La boîte branchée, l'étape suivante de la prise en main est le tableau de bord.
  useEffect(() => {
    if (state.status !== "success") return;
    const minuteur = setTimeout(() => router.push("/app"), REDIRECT_DELAY_MS);
    return () => clearTimeout(minuteur);
  }, [state.status, router]);

  const applyPreset = (label: string) => {
    const preset = SMTP_PRESETS.find((item) => item.label === label);
    if (!preset) return;
    setHost(preset.host);
    setPort(String(preset.port));
    setImapHost(preset.imapHost);
  };

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      {state.status === "success" && (
        <FormMessage tone="success">
          {state.message} Retour au tableau de bord…
        </FormMessage>
      )}

      <Field label="Votre messagerie" hint="Remplit les serveurs et le port ; vous pouvez les modifier.">
        <Select defaultValue="" onChange={(event) => applyPreset(event.target.value)}>
          <option value="">Autre (saisie manuelle)</option>
          {SMTP_PRESETS.map((preset) => (
            <option key={preset.label} value={preset.label}>
              {preset.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_8rem]">
        <Field label="Serveur SMTP" error={errors.host} isRequired>
          <Input name="host" value={host} onChange={(event) => setHost(event.target.value)} autoComplete="off" />
        </Field>
        <Field label="Port" error={errors.port} isRequired>
          <Input name="port" inputMode="numeric" value={port} onChange={(event) => setPort(event.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Identifiant" hint="Souvent votre adresse e-mail." error={errors.user} isRequired>
          <Input name="user" defaultValue={values.user} autoComplete="username" />
        </Field>
        <Field label="Mot de passe" error={errors.password} isRequired>
          <PasswordInput name="password" autoComplete="current-password" />
        </Field>
        <Field label="Adresse d'envoi" hint="L'adresse que verront vos clients." error={errors.emailAddress} isRequired>
          <Input name="emailAddress" type="email" defaultValue={values.emailAddress} />
        </Field>
        <Field label="Nom d'expéditeur" error={errors.displayName} isRequired>
          <Input name="displayName" defaultValue={values.displayName ?? defaultSenderName} />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-medium">Lecture des réponses (facultatif)</legend>
        <p className="text-sm text-fg-muted">
          Avec le serveur de réception (IMAP), Relia lit les réponses à vos relances : promesses de règlement,
          contestations… et met les relances en pause quand un client répond. Mêmes identifiants que ci-dessus.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_8rem]">
          <Field label="Serveur IMAP" hint="Laissez vide pour gérer les réponses vous-même." error={errors.imapHost}>
            <Input name="imapHost" value={imapHost} onChange={(event) => setImapHost(event.target.value)} autoComplete="off" />
          </Field>
          <Field label="Port" error={errors.imapPort}>
            <Input name="imapPort" inputMode="numeric" defaultValue={values.imapPort ?? String(IMAP_PORT)} />
          </Field>
        </div>
      </fieldset>
      <div className="flex justify-end">
        <Button type="submit" status={isPending ? "loading" : "idle"} loadingLabel="Vérification…">
          Vérifier et connecter
        </Button>
      </div>
    </form>
  );
}
