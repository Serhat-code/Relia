import { cn } from "@/lib/cn";

/**
 * Apparence des boutons, sans directive "use client" : utilisable par les composants serveur
 * (par exemple pour donner l'apparence d'un bouton à un lien).
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
/** idle : au repos · loading : action en cours (loader intégré) · success : l'anneau se ferme. */
export type ButtonStatus = "idle" | "loading" | "success";

const BASE =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium " +
  "transition duration-hover ease-standard active:not-aria-disabled:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-default [&>svg]:size-4 [&>svg]:shrink-0";

/** Halo qui s'intensifie au survol : ombre douce au repos, halo complet au survol. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg shadow-raised hover:bg-accent-hover hover:shadow-halo",
  secondary: "border border-border bg-elevated text-fg hover:border-glow hover:bg-surface hover:shadow-halo",
  ghost: "text-fg-muted hover:bg-surface hover:text-fg",
  danger: "bg-danger text-danger-fg shadow-raised hover:shadow-[0_0_24px_-6px_var(--danger)]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

/** Le loader prend la couleur du texte sur les fonds pleins, où le dégradé de marque disparaîtrait. */
export const FILLED_VARIANTS: ReadonlySet<ButtonVariant> = new Set(["primary", "danger"]);

export type ButtonStyle = { variant?: ButtonVariant; size?: ButtonSize; className?: string };

/** Apparence d'un bouton, pour un lien par exemple : <Link className={buttonClasses({ variant: "secondary" })}>. */
export function buttonClasses({ variant = "primary", size = "md", className }: ButtonStyle = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

