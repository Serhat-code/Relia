"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Input } from "./Field";

/** Champ mot de passe avec bouton afficher / masquer (à placer dans un Field). */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={isVisible ? "text" : "password"} className={cn("pr-11", className)} />
      <button
        type="button"
        onClick={() => setIsVisible((visible) => !visible)}
        aria-label={isVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={isVisible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-fg-muted transition duration-hover hover:text-fg"
      >
        {isVisible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
      </button>
    </div>
  );
}
