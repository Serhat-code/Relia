"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Section } from "../../_components/Section";

const SIREN_PATTERN = /^\d{9}$/;

export function FieldsShowcase() {
  const [siren, setSiren] = useState("12345");
  const sirenError = siren !== "" && !SIREN_PATTERN.test(siren) ? "Un SIREN compte 9 chiffres." : undefined;

  return (
    <Section
      title="Champs"
      description="Libellé, aide et erreur reliés automatiquement au champ (aria-describedby, aria-invalid). Halo d'accent au focus."
    >
      <Card className="grid gap-5 p-6 md:grid-cols-2">
        <Field label="Nom du débiteur" isRequired>
          <Input placeholder="Atelier Morel" autoComplete="organization" />
        </Field>
        <Field label="Numéro SIREN" hint="9 chiffres, sans espace" error={sirenError}>
          <Input
            value={siren}
            onChange={(event) => setSiren(event.target.value.trim())}
            inputMode="numeric"
            className="tabular-nums"
          />
        </Field>
        <Field label="Type de client" hint="Un débiteur particulier ne reçoit jamais de mention de l'indemnité de 40 €.">
          <Select defaultValue="b2b">
            <option value="b2b">Professionnel (B2B)</option>
            <option value="b2c">Particulier (B2C)</option>
          </Select>
        </Field>
        <Field label="Montant TTC">
          <Input inputMode="decimal" placeholder="0,00 €" className="text-right tabular-nums" />
        </Field>
        <Field label="Notes internes" className="md:col-span-2">
          <Textarea placeholder="Interlocuteur, conditions particulières…" />
        </Field>
      </Card>
    </Section>
  );
}
