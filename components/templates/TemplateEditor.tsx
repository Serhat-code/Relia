"use client";

import { useActionState, useId, useRef, useState } from "react";
import { updateTemplateAction } from "@/app/app/modeles/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { findTemplateViolations } from "@/lib/compliance/template-rules";
import type { ClientType } from "@/lib/debtors/client-type";
import { IDLE_STATE } from "@/lib/forms/form-state";
import { renderTemplate, TEMPLATE_VARIABLES, type TemplateVariable } from "@/lib/templates/engine";
import { previewContext } from "@/lib/templates/preview";
import { MessagePreview } from "./MessagePreview";

type TemplateEditorProps = {
  templateId: string;
  clientType: ClientType;
  initial: { name: string; subject: string; bodyMarkdown: string };
  organizationName: string;
  today: string;
};

const VARIABLE_NAMES = Object.keys(TEMPLATE_VARIABLES) as TemplateVariable[];

/** Modèle personnalisé : les règles (§2.5, §2.6) sont vérifiées pendant la saisie, puis par le serveur et la base. */
export function TemplateEditor({ templateId, clientType, initial, organizationName, today }: TemplateEditorProps) {
  const [state, formAction, isPending] = useActionState(updateTemplateAction.bind(null, templateId), IDLE_STATE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const [name, setName] = useState(initial.name);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.bodyMarkdown);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const violationsId = useId();

  const violations = findTemplateViolations({ clientType, subject, body });
  const preview = renderTemplate({ clientType, subject, bodyMarkdown: body }, previewContext(clientType, organizationName, today));

  // Insère la variable à l'emplacement du curseur, puis y replace le curseur.
  const insertVariable = (variable: TemplateVariable) => {
    const textarea = bodyRef.current;
    const token = `{{${variable}}}`;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    setBody(`${body.slice(0, start)}${token}${body.slice(end)}`);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
      <form action={formAction} noValidate className="flex flex-col gap-5">
        {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
        {state.status === "success" && <FormMessage tone="success">{state.message}</FormMessage>}

        <Field label="Nom du modèle" error={errors.name} isRequired>
          <Input name="name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Objet" error={errors.subject} isRequired>
          <Input name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
        </Field>
        <Field
          label="Message"
          hint="**texte** pour mettre en gras ; une ligne vide sépare les paragraphes."
          error={errors.bodyMarkdown}
          isRequired
        >
          <Textarea
            ref={bodyRef}
            name="bodyMarkdown"
            rows={16}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="font-mono text-xs leading-relaxed"
          />
        </Field>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Insérer une variable</p>
          <div className="flex flex-wrap gap-2">
            {VARIABLE_NAMES.map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => insertVariable(variable)}
                title={`${TEMPLATE_VARIABLES[variable].label} — exemple : ${TEMPLATE_VARIABLES[variable].example}`}
                className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-fg-muted transition duration-hover hover:border-glow hover:text-fg"
              >
                {`{{${variable}}}`}
              </button>
            ))}
          </div>
        </div>

        {violations.length > 0 && (
          <div id={violationsId}>
            <FormMessage tone="error">
            <ul className="flex flex-col gap-1">
              {violations.map((violation) => (
                <li key={violation}>{violation}</li>
              ))}
            </ul>
            </FormMessage>
          </div>
        )}

        <div className="flex justify-end border-t border-border pt-5">
          <Button
            type="submit"
            status={isPending ? "loading" : "idle"}
            loadingLabel="Enregistrement…"
            aria-describedby={violations.length > 0 ? violationsId : undefined}
          >
            Enregistrer le modèle
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Aperçu avec une facture fictive</p>
        {preview.ok ? (
          <MessagePreview from={organizationName} subject={preview.subject} bodyMarkdown={preview.bodyMarkdown} />
        ) : (
          <FormMessage tone="error">{preview.error}</FormMessage>
        )}
      </div>
    </div>
  );
}

