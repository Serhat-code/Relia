"use client";

import { CircleAlert } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";

export type Choice<T extends string> = { value: T; label: string; description?: string };

type ChoiceCardsProps<T extends string> = {
  name: string;
  legend: string;
  choices: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  isRequired?: boolean;
  className?: string;
};

/** Choix exclusif présenté en cartes : de vrais boutons radio, donc clavier et lecteurs d'écran natifs. */
export function ChoiceCards<T extends string>({
  name,
  legend,
  choices,
  value,
  onChange,
  error,
  isRequired = false,
  className,
}: ChoiceCardsProps<T>) {
  const errorId = useId();

  return (
    <fieldset
      className={cn("flex flex-col gap-1.5", className)}
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-1.5 text-sm font-medium text-fg">
        {legend}
        {isRequired && (
          <span aria-hidden className="text-danger">
            {" "}
            *
          </span>
        )}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {choices.map((choice) => {
          const isSelected = choice.value === value;
          return (
            <label
              key={choice.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border bg-surface p-3.5 transition duration-hover ease-standard",
                "has-focus-visible:ring-3 has-focus-visible:ring-accent/30",
                isSelected ? "border-accent bg-accent-soft" : "border-border hover:border-glow",
                error && !isSelected && "border-danger/60",
              )}
            >
              <input
                type="radio"
                name={name}
                value={choice.value}
                checked={isSelected}
                onChange={() => onChange(choice.value)}
                required={isRequired}
                className="mt-0.5 size-4 shrink-0 accent-accent"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-fg">{choice.label}</span>
                {choice.description && <span className="text-xs text-fg-muted">{choice.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-xs font-medium text-danger">
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </fieldset>
  );
}
