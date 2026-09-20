import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@/lib/auth/redirect";
import { AuthFooter, AuthHeading } from "../_components/AuthHeading";
import { SignInForm } from "../_components/SignInForm";

export const metadata: Metadata = { title: "Connexion" };

const NOTICES: Readonly<Record<string, string>> = {
  "lien-invalide": "Ce lien n'est plus valide. Demandez-en un nouveau ou connectez-vous.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const errorKey = typeof params.erreur === "string" ? params.erreur : undefined;

  return (
    <>
      <AuthHeading title="Connexion" description="Retrouvez le suivi de vos règlements." />
      <SignInForm next={safeNextPath(params.next)} notice={errorKey ? NOTICES[errorKey] : undefined} />
      <AuthFooter>
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-medium text-link underline-offset-4 hover:underline">
          Créer un compte
        </Link>
      </AuthFooter>
    </>
  );
}
