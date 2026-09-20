import type { ReactNode } from "react";
import { FormMessage } from "@/components/ui/FormMessage";
import { isSupabaseConfigured } from "@/lib/env";

export function AuthHeading({ title, description }: { title: string; description: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-fg-muted">{description}</p>
      {!isSupabaseConfigured() && (
        <div className="mt-4">
          <FormMessage tone="info">
            Supabase n&apos;est pas encore configuré : copiez <code>.env.example</code> vers <code>.env.local</code>{" "}
            et renseignez l&apos;URL et les clés de votre projet.
          </FormMessage>
        </div>
      )}
    </div>
  );
}

export function AuthFooter({ children }: { children: ReactNode }) {
  return <p className="mt-8 text-center text-sm text-fg-muted">{children}</p>;
}
