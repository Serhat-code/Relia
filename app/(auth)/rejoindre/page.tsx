import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button-styles";
import { FormMessage } from "@/components/ui/FormMessage";
import { getSessionState } from "@/lib/data/session";
import { AuthHeading } from "../_components/AuthHeading";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = { title: "Rejoindre une organisation", robots: { index: false, follow: false } };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/**
 * Lien d'invitation (§7). Le jeton n'est consommé que sur soumission du formulaire : l'afficher ne
 * le brûle pas. Le compte doit exister et porter l'adresse invitée — c'est la base qui le vérifie.
 */
export default async function JoinPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getSessionState(), searchParams]);
  const token = firstValue(params.jeton).trim();

  if (token === "") {
    return (
      <>
        <AuthHeading title="Lien incomplet" description="Ce lien d'invitation ne contient pas de jeton." />
        <FormMessage tone="error">Demandez à la personne qui vous a invité de vous renvoyer le lien complet.</FormMessage>
      </>
    );
  }

  // Le lien mène d'abord à l'inscription : le compte doit exister, avec l'adresse invitée.
  if (session.kind === "anonymous") {
    const next = encodeURIComponent(`/rejoindre?jeton=${token}`);
    return (
      <>
        <AuthHeading
          title="Vous êtes invité"
          description="Créez votre compte avec l'adresse à laquelle l'invitation a été envoyée, puis revenez ici."
        />
        <div className="flex flex-col gap-3">
          <Link href={`/inscription?next=${next}`} className={buttonClasses()}>
            Créer mon compte
          </Link>
          <Link href={`/connexion?next=${next}`} className={buttonClasses({ variant: "secondary" })}>
            J&apos;ai déjà un compte
          </Link>
        </div>
      </>
    );
  }

  if (session.kind === "member") {
    return (
      <>
        <AuthHeading
          title="Vous avez déjà une organisation"
          description="Un compte ne peut appartenir qu'à une seule organisation."
        />
        <FormMessage tone="info">
          Pour rejoindre celle qui vous invite, créez un compte avec une autre adresse, ou demandez à quitter la vôtre.
        </FormMessage>
        <Link href="/app" className={buttonClasses({ variant: "secondary" })}>
          Retour au tableau de bord
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title="Rejoindre l'organisation"
        description="Votre compte sera rattaché à l'organisation qui vous a invité, avec le rôle prévu."
      />
      <JoinForm token={token} />
    </>
  );
}
