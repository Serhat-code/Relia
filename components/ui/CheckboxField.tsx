"use client";

import { CircleAlert } from "lucide-react";
import { useId, type ReactNode } from "react";

type CheckboxFieldProps = {
  name: string;
  label: ReactNode;
  error?: string;
  defaultChecked?: boolean;
  /** Mode contrôlé (état tenu par le parent) : à fournir avec onCheckedChange. */
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

/** Case à cocher avec libellé cliquable (qui peut contenir un lien) et erreur reliée. */
export function CheckboxField({ name, label, error, defaultChecked, checked, onCheckedChange }: CheckboxFieldProps) {
  const id = useId();
  const errorId = `${id}-erreur`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          {...(checked === undefined
            ? { defaultChecked }
            : { checked, onChange: (event) => onCheckedChange?.(event.target.checked) })}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent"
        />
        <label htmlFor={id} className="cursor-pointer text-sm text-fg-muted">
          {label}
        </label>
      </div>
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-xs font-medium text-danger">
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
