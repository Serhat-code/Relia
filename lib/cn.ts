import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** tailwind-merge, instruit des utilitaires maison de globals.css. */
const mergeClasses = extendTailwindMerge({
  extend: {
    classGroups: {
      "bg-image": [{ "bg-gradient": ["brand", "glow"] }, "bg-stat-glow"],
      shadow: [{ shadow: ["raised", "halo"] }],
      duration: [{ duration: ["hover", "enter", "page"] }],
      ease: [{ ease: ["standard"] }],
      "font-family": [{ font: ["display"] }],
    },
  },
});

/** Compose des classes conditionnelles ; en cas de conflit, la dernière l'emporte. */
export function cn(...inputs: ClassValue[]): string {
  return mergeClasses(clsx(inputs));
}
