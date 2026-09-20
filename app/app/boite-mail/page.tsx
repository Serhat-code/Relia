import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { MailboxCard } from "@/components/mailbox/MailboxCard";
import { SmtpForm } from "@/components/mailbox/SmtpForm";
import { Reveal } from "@/components/motion/Reveal";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/FormMessage";
import { getMailbox } from "@/lib/data/mailbox";
import { requireMember } from "@/lib/data/session";
import { getOAuthClient } from "@/lib/env";
import { firstValue, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Boîte d'envoi" };

/** Retours du parcours OAuth (routes /connexion et /retour). */
const ERRORS: Readonly<Record<string, string>> = {
  droits: "Seuls le propriétaire et les administrateurs peuvent connecter la boîte d'envoi.",
  indisponible: "Cette connexion n'est pas encore disponible. Utilisez le SMTP de votre messagerie en attendant.",
  refus: "La connexion a été annulée : aucune autorisation n'a été donnée.",
  etat: "La connexion a expiré ou n'a pas pu être vérifiée. Recommencez.",
  echange: "La messagerie n'a pas confirmé l'accès. Recommencez.",
  permissions: "L'autorisation d'envoyer des e-mails n'a pas été accordée : cochez-la lors de la connexion.",
  adresse: "L'adresse e-mail du compte n'a pas pu être lue.",
  enregistrement: "La boîte d'envoi n'a pas pu être enregistrée. Recommencez.",
};

function ProviderButton({ href, label, isAvailable }: { href: string; label: ReactNode; isAvailable: boolean }) {
  const className = buttonClasses({ variant: "secondary", size: "lg", className: "w-full justify-start" });
  if (!isAvailable) {
    return (
      <span aria-disabled="true" className={`${className} pointer-events-none opacity-50`}>
        {label}
      </span>
    );
  }
  // Lien classique (et non <Link>) : la route redirige vers Google ou Microsoft.
  return (
    <a href={href} className={className}>
      {label}
    </a>
  );
}

export default async function MailboxPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [member, mailbox, params] = await Promise.all([requireMember(), getMailbox(), searchParams]);
  const canManage = member.role !== "member";
  const error = ERRORS[firstValue(params.erreur)];
  const isGoogleAvailable = canManage && getOAuthClient("google") !== null;
  const isMicrosoftAvailable = canManage && getOAuthClient("microsoft") !== null;

  return (
    <>
      <PageHeader
        title="Boîte d'envoi"
        description="Vos relances partent de votre propre adresse, à votre nom : vos clients vous répondent directement. Relia n'envoie jamais rien en son nom."
      />
      <div className="flex max-w-4xl flex-col gap-6">
        {error && (
          <Reveal index={1}>
            <FormMessage tone="error">{error}</FormMessage>
          </Reveal>
        )}
        {firstValue(params.connectee) === "1" && (
          <Reveal index={1}>
            <FormMessage tone="success">Boîte d&apos;envoi connectée. Envoyez-vous un e-mail de test pour vérifier.</FormMessage>
          </Reveal>
        )}

        {mailbox && (
          <Reveal index={1}>
            <MailboxCard mailbox={mailbox} canManage={canManage} />
          </Reveal>
        )}

        {canManage && (
          <Reveal index={2}>
            <Card>
              <CardHeader>
                <CardTitle>{mailbox ? "Changer de boîte d'envoi" : "Connecter votre boîte d'envoi"}</CardTitle>
                <CardDescription>
                  Relia obtient seulement le droit d&apos;envoyer vos relances et de lire les réponses de vos clients, jamais
                  votre mot de passe. Vous pouvez retirer cet accès à tout moment.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ProviderButton
                    href="/app/boite-mail/connexion/google"
                    label="Gmail ou Google Workspace"
                    isAvailable={isGoogleAvailable}
                  />
                  <ProviderButton
                    href="/app/boite-mail/connexion/microsoft"
                    label="Outlook ou Microsoft 365"
                    isAvailable={isMicrosoftAvailable}
                  />
                </div>
                <details className="group rounded-xl border border-border p-4">
                  <summary className="cursor-pointer text-sm font-medium">Autre messagerie (SMTP)</summary>
                  <div className="mt-5">
                    <SmtpForm defaultSenderName={member.organization.name} />
                  </div>
                </details>
                <p className="flex items-center gap-2 text-xs text-fg-muted">
                  <ShieldCheck aria-hidden className="size-4 shrink-0 text-success" />
                  Jetons et mots de passe chiffrés, hébergés dans l&apos;Union européenne.
                </p>
              </CardContent>
            </Card>
          </Reveal>
        )}

        {!canManage && !mailbox && (
          <Reveal index={2}>
            <FormMessage tone="info">
              Aucune boîte d&apos;envoi n&apos;est connectée. Demandez au propriétaire ou à un administrateur de la connecter.
            </FormMessage>
          </Reveal>
        )}
      </div>
    </>
  );
}
