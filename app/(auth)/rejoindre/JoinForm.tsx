"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { IDLE_STATE } from "@/lib/forms/form-state";
import { acceptInvitationAction } from "./actions";

/** Confirmation explicite : le jeton ne sert qu'une fois, il ne doit pas partir sur un affichage. */
export function JoinForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(acceptInvitationAction, IDLE_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="jeton" value={token} />
      {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
      <Button type="submit" status={isPending ? "loading" : "idle"} loadingLabel="Rattachement…">
        Rejoindre l&apos;organisation
      </Button>
    </form>
  );
}
