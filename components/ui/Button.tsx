"use client";

import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { ReliaLoader } from "@/components/brand/ReliaLoader";
import {
  FILLED_VARIANTS,
  buttonClasses,
  type ButtonSize,
  type ButtonStatus,
  type ButtonStyle,
  type ButtonVariant,
} from "./button-styles";

export type { ButtonSize, ButtonStatus, ButtonVariant };

type ButtonProps = ComponentProps<"button"> &
  ButtonStyle & {
    status?: ButtonStatus;
    /** Icône de tête ; remplacée par le loader pendant l'action. */
    icon?: ReactNode;
    /** Libellé affiché pendant l'action (« Envoi… »). */
    loadingLabel?: string;
  };

export function Button({
  variant = "primary",
  size = "md",
  status = "idle",
  icon,
  loadingLabel,
  className,
  type = "button",
  onClick,
  children,
  ...props
}: ButtonProps) {
  const isBusy = status !== "idle";

  // aria-disabled plutôt que disabled : le bouton garde le focus clavier pendant l'action.
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isBusy) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...props}
      type={type}
      aria-busy={status === "loading" || undefined}
      aria-disabled={isBusy || props["aria-disabled"]}
      className={buttonClasses({ variant, size, className })}
      onClick={handleClick}
    >
      {isBusy ? (
        <ReliaLoader size="sm" state={status} tone={FILLED_VARIANTS.has(variant) ? "current" : "brand"} isDecorative />
      ) : (
        icon
      )}
      {status === "loading" && loadingLabel ? loadingLabel : children}
    </button>
  );
}
