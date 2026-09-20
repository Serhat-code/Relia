import type { Metadata } from "next";
import Link from "next/link";
import { AuthFooter, AuthHeading } from "../_components/AuthHeading";
import { ForgotPasswordForm } from "../_components/PasswordForms";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading
        title="Mot de passe oublié"
        description="Indiquez votre adresse : nous vous envoyons un lien pour en choisir un nouveau."
      />
      <ForgotPasswordForm />
      <AuthFooter>
        <Link href="/connexion" className="font-medium text-link underline-offset-4 hover:underline">
          Revenir à la connexion
        </Link>
      </AuthFooter>
    </>
  );
}
