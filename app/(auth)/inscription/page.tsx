import type { Metadata } from "next";
import Link from "next/link";
import { AuthFooter, AuthHeading } from "../_components/AuthHeading";
import { SignUpForm } from "../_components/SignUpForm";

export const metadata: Metadata = { title: "Créer un compte" };

export default function SignUpPage() {
  return (
    <>
      <AuthHeading
        title="Créer votre compte"
        description="Quelques minutes suffisent : compte, boîte d'envoi, premières factures."
      />
      <SignUpForm />
      <AuthFooter>
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-medium text-link underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </AuthFooter>
    </>
  );
}
