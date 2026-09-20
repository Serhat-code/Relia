"use client";

import Link from "next/link";
import { useActionState, useId, useState, type ChangeEvent } from "react";
import { createInvoiceAction } from "@/app/app/factures/actions";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/button-styles";
import { ChoiceCards, type Choice } from "@/components/ui/ChoiceCards";
import { Field, Input } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import type { DebtorSuggestion } from "@/lib/data/debtors";
import type { ClientType } from "@/lib/debtors/client-type";
import { IDLE_STATE } from "@/lib/forms/form-state";
import { addDays } from "@/lib/invoices/dates";

/** Délai proposé par défaut entre émission et échéance (modifiable). */
const DEFAULT_PAYMENT_DAYS = 30;

const CLIENT_TYPE_CHOICES: readonly Choice<ClientType>[] = [
  {
    value: "b2b",
    label: "Professionnel",
    description: "Entreprise, association, indépendant. Les relances peuvent rappeler les pénalités légales.",
  },
  {
    value: "b2c",
    label: "Particulier",
    description: "Relances plus espacées, au ton mesuré, sans pénalités de retard professionnelles.",
  },
];

const isClientType = (value: string | undefined): value is ClientType => value === "b2b" || value === "b2c";

type InvoiceFormProps = { today: string; debtors: readonly DebtorSuggestion[] };

export function InvoiceForm({ today, debtors }: InvoiceFormProps) {
  const [state, formAction, isPending] = useActionState(createInvoiceAction, IDLE_STATE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const debtorListId = useId();

  const [clientType, setClientType] = useState<ClientType | null>(isClientType(values.clientType) ? values.clientType : null);
  const [siren, setSiren] = useState(values.debtorSiren ?? "");
  const [email, setEmail] = useState(values.debtorEmail ?? "");
  const [issuedAt, setIssuedAt] = useState(values.issuedAt ?? today);
  const [dueAt, setDueAt] = useState(values.dueAt ?? addDays(today, DEFAULT_PAYMENT_DAYS));
  const [isDueEdited, setIsDueEdited] = useState(Boolean(values.dueAt));

  // Client déjà connu : on reprend son type, son SIREN et son e-mail sans écraser une saisie.
  const handleDebtorName = (event: ChangeEvent<HTMLInputElement>) => {
    const name = event.target.value.trim().toLowerCase();
    const known = debtors.find((debtor) => debtor.name.toLowerCase() === name);
    if (!known) return;
    setClientType(known.clientType);
    if (!siren && known.siren) setSiren(known.siren);
    if (!email && known.email) setEmail(known.email);
  };

  const handleIssuedAt = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setIssuedAt(next);
    if (!isDueEdited && /^\d{4}-\d{2}-\d{2}$/.test(next)) setDueAt(addDays(next, DEFAULT_PAYMENT_DAYS));
  };

  return (
    <form action={formAction} noValidate className="flex flex-col gap-8">
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}

      <section className="flex flex-col gap-5" aria-labelledby="section-client">
        <h2 id="section-client" className="text-base font-semibold">
          Client
        </h2>
        <Field label="Nom du client" error={errors.debtorName} isRequired>
          <Input
            name="debtorName"
            defaultValue={values.debtorName}
            list={debtorListId}
            autoComplete="off"
            onChange={handleDebtorName}
            autoFocus
          />
        </Field>
        <datalist id={debtorListId}>
          {debtors.map((debtor, index) => (
            <option key={`${debtor.name}-${index}`} value={debtor.name} />
          ))}
        </datalist>
        <ChoiceCards
          name="clientType"
          legend="Type de client"
          choices={CLIENT_TYPE_CHOICES}
          value={clientType}
          onChange={setClientType}
          error={errors.clientType}
          isRequired
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="SIREN" hint="Facultatif. 9 chiffres, pour reconnaître le client." error={errors.debtorSiren}>
            <Input
              name="debtorSiren"
              inputMode="numeric"
              value={siren}
              onChange={(event) => setSiren(event.target.value)}
            />
          </Field>
          <Field label="E-mail du client" hint="L'adresse qui recevra les relances." error={errors.debtorEmail}>
            <Input name="debtorEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-5" aria-labelledby="section-facture">
        <h2 id="section-facture" className="text-base font-semibold">
          Facture
        </h2>
        <Field label="Numéro de facture" error={errors.number} isRequired className="sm:max-w-xs">
          <Input name="number" defaultValue={values.number} autoComplete="off" />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Montant HT" hint="Facultatif. En euros." error={errors.amountHt}>
            <Input name="amountHt" inputMode="decimal" defaultValue={values.amountHt} className="tabular-nums" />
          </Field>
          <Field label="Montant TTC" hint="En euros, par exemple 1 200,00." error={errors.amountTtc} isRequired>
            <Input name="amountTtc" inputMode="decimal" defaultValue={values.amountTtc} className="tabular-nums" />
          </Field>
          <Field label="Date d'émission" error={errors.issuedAt} isRequired>
            <Input name="issuedAt" type="date" value={issuedAt} onChange={handleIssuedAt} />
          </Field>
          <Field label="Échéance" hint={isDueEdited ? undefined : "30 jours après l'émission, modifiable."} error={errors.dueAt} isRequired>
            <Input
              name="dueAt"
              type="date"
              value={dueAt}
              min={issuedAt}
              onChange={(event) => {
                setDueAt(event.target.value);
                setIsDueEdited(true);
              }}
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
        <Link href="/app/factures" className={buttonClasses({ variant: "ghost" })}>
          Annuler
        </Link>
        <Button type="submit" status={isPending ? "loading" : "idle"} loadingLabel="Enregistrement…">
          Enregistrer la facture
        </Button>
      </div>
    </form>
  );
}
