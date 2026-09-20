"use client";

import { ChevronDown, CircleAlert } from "lucide-react";
import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type FieldControl = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
};

const FieldContext = createContext<FieldControl | null>(null);

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  isRequired?: boolean;
  className?: string;
  children: ReactNode;
};

/** Libellé, aide et erreur reliés au champ enfant (Input, Textarea ou Select) sans câblage manuel. */
export function Field({ label, hint, error, isRequired = false, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-aide`;
  const errorId = `${id}-erreur`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  const control: FieldControl = {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    required: isRequired || undefined,
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
        {isRequired && (
          <span aria-hidden className="text-danger">
            {" "}
            *
          </span>
        )}
      </label>
      <FieldContext value={control}>{children}</FieldContext>
      {hint && (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-xs font-medium text-danger">
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-muted " +
  "transition duration-hover ease-standard hover:border-glow " +
  "focus-visible:outline-none focus:border-accent focus:ring-3 focus:ring-accent/25 " +
  "aria-invalid:border-danger aria-invalid:focus:ring-danger/25 disabled:cursor-not-allowed disabled:opacity-50";

const useFieldControl = () => useContext(FieldContext) ?? undefined;

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...useFieldControl()} {...props} className={cn(CONTROL, "h-10", className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...useFieldControl()} {...props} className={cn(CONTROL, "min-h-24 py-2", className)} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...useFieldControl()} {...props} className={cn(CONTROL, "h-10 appearance-none pr-9", className)}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted"
      />
    </div>
  );
}
