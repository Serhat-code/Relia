"use client";

import { useActionState, useState } from "react";
import { updateDebtorAction } from "@/app/app/debiteurs/actions";
import { Button } from "@/components/ui/Button";
import { ChoiceCards, type Choice } from "@/components/ui/ChoiceCards";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import type { ClientType } from "@/lib/debtors/client-type";
import type { DebtorInput } from "@/lib/debtors/debtor-form";
import { IDLE_STATE } from "@/lib/forms/form-state";

type LegalForm = "legal_entity" | "individual";

const CLIENT_TYPE_CHOICES: readonly Choice<ClientType>[] = [
  { value: "b2b", label: "Professionnel", description: "Entreprise, association, indépendant." },
  { value: "b2c", label: "Particulier", description: "Relances plus espacées, sans pénalités professionnelles." },
];

const LEGAL_FORM_CHOICES: readonly Choice<LegalForm>[] = [
  { value: "legal_entity", label: "Personne morale", description: "Société, association… identifiée par son SIREN." },
  { value: "individual", label: "Entrepreneur individuel", description: "Personne physique, même avec un SIREN." },
];

type DebtorFormProps = { debtorId: string; debtor: DebtorInput };

/** Fiche d'un débiteur. Le type de client décide des modèles de relance (§2.5) ; la forme juridique, du score (§2.4). */
export function DebtorForm({ debtorId, debtor }: DebtorFormProps) {
  const [state, formAction, isPending] = useActionState(updateDebtorAction.bind(null, debtorId), IDLE_STATE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const [clientType, setClientType] = useState<ClientType>(debtor.clientType);
  const [legalForm, setLegalForm] = useState<LegalForm>(debtor.isLegalEntity ? "legal_entity" : "individual");

  const text = (field: keyof DebtorInput & keyof typeof values, fallback: string | null) => values[field] ?? fallback ?? "";

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      {state.status === "success" && <FormMessage tone="success">{state.message}</FormMessage>}

      <Field label="Nom du client" error={errors.name} isRequired>
        <Input name="name" defaultValue={text("name", debtor.name)} autoComplete="off" />
      </Field>
      <ChoiceCards
        name="clientType"
        legend="Type de client"
        choices={CLIENT_TYPE_CHOICES}
        value={clientType}
        onChange={setClientType}
        error={errors.clientType}
        isRequired
      />
      {clientType === "b2b" && (
        <ChoiceCards
          name="legalForm"
          legend="Forme juridique"
          choices={LEGAL_FORM_CHOICES}
          value={legalForm}
          onChange={setLegalForm}
        />
      )}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label="SIREN"
          hint={clientType === "b2b" && legalForm === "legal_entity" ? "Obligatoire pour une personne morale." : "Facultatif."}
          error={errors.siren}
        >
          <Input name="siren" inputMode="numeric" defaultValue={text("siren", debtor.siren)} />
        </Field>
        <Field label="Nom du contact" error={errors.contactName}>
          <Input name="contactName" defaultValue={text("contactName", debtor.contactName)} />
        </Field>
        <Field label="E-mail" hint="L'adresse qui reçoit les relances." error={errors.contactEmail}>
          <Input name="contactEmail" type="email" defaultValue={text("contactEmail", debtor.contactEmail)} />
        </Field>
        <Field label="Téléphone" error={errors.phone}>
          <Input name="phone" type="tel" defaultValue={text("phone", debtor.phone)} />
        </Field>
      </div>
      <Field label="Adresse" error={errors.address}>
        <Textarea name="address" rows={2} defaultValue={text("address", debtor.address)} />
      </Field>
      <Field label="Notes" hint="Visibles de votre équipe seulement, jamais envoyées au client." error={errors.notes}>
        <Textarea name="notes" rows={3} defaultValue={text("notes", debtor.notes)} />
      </Field>

      <div className="flex justify-end border-t border-border pt-5">
        <Button type="submit" status={isPending ? "loading" : "idle"} loadingLabel="Enregistrement…">
          Enregistrer la fiche
        </Button>
      </div>
    </form>
  );
}
