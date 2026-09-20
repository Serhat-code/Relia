"use client";

import { Check, Copy, Link2, UserPlus, X } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { inviteMemberAction, revokeInvitationAction } from "@/app/app/parametres/actions";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { formatDate } from "@/lib/format";
import { IDLE_STATE } from "@/lib/forms/form-state";
import { INVITE_ROLES } from "@/lib/organization/settings-form";

export type PendingInvitationView = { id: string; email: string; role: string; expiresAt: string };

const ROLE_LABELS: Readonly<Record<string, string>> = { admin: "Administrateur", member: "Membre" };

/** Le lien n'est montré qu'une fois : la base ne garde que l'empreinte du jeton. */
function InvitationLink({ token }: { token: string }) {
  const [isCopied, setIsCopied] = useState(false);
  const toast = useToast();
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/rejoindre?jeton=${token}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.show({ tone: "error", title: "Copie impossible : sélectionnez le lien à la main." });
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-glow bg-accent-soft p-4">
      <span className="flex items-center gap-2 text-sm font-medium text-fg">
        <Link2 aria-hidden className="size-4 shrink-0 text-link" />
        Lien d&apos;invitation à transmettre
      </span>
      <p className="text-xs text-fg-muted">
        Copiez-le maintenant : il ne sera plus affiché. Il vaut sept jours et ne fonctionne que pour l&apos;adresse invitée.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1" />
        <Button type="button" variant="secondary" icon={isCopied ? <Check aria-hidden /> : <Copy aria-hidden />} onClick={copy}>
          {isCopied ? "Copié" : "Copier"}
        </Button>
      </div>
    </div>
  );
}

export function TeamInvitations({ invitations, canManage }: { invitations: PendingInvitationView[]; canManage: boolean }) {
  const [state, formAction, isPending] = useActionState(inviteMemberAction, IDLE_STATE);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevoking, startRevoke] = useTransition();
  const toast = useToast();

  const revoke = (id: string) =>
    startRevoke(async () => {
      setRevokingId(id);
      const result = await revokeInvitationAction(id);
      setRevokingId(null);
      if (result.ok) toast.show({ tone: "success", title: "Invitation annulée." });
      else toast.show({ tone: "error", title: result.error ?? "Annulation impossible." });
    });

  if (!canManage && invitations.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      {invitations.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm text-fg">{invitation.email}</span>
                <span className="truncate text-xs text-fg-muted">
                  {ROLE_LABELS[invitation.role] ?? invitation.role} · invitation valable jusqu&apos;au{" "}
                  {formatDate(invitation.expiresAt)}
                </span>
              </div>
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  icon={<X aria-hidden />}
                  status={isRevoking && revokingId === invitation.id ? "loading" : "idle"}
                  onClick={() => revoke(invitation.id)}
                >
                  Annuler
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form action={formAction} noValidate className="flex flex-col gap-4">
          {state.status === "error" && state.message && <FormMessage tone="error">{state.message}</FormMessage>}
          {state.status === "success" && <InvitationLink token={state.message} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Inviter une personne" hint="Elle créera son compte avec cette adresse, puis rejoindra votre organisation.">
              <Input name="email" type="email" placeholder="prenom@entreprise.fr" autoComplete="off" />
            </Field>
            <Button type="submit" icon={<UserPlus aria-hidden />} status={isPending ? "loading" : "idle"}>
              Créer le lien
            </Button>
          </div>
          <Field label="Rôle">
            <Select name="role" defaultValue="member">
              {INVITE_ROLES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      )}
    </div>
  );
}
