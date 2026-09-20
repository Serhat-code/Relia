import type { Metadata } from "next";
import { AuthHeading } from "../_components/AuthHeading";
import { ResetPasswordForm } from "../_components/PasswordForms";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthHeading title="Nouveau mot de passe" description="Choisissez le mot de passe de votre compte Relia." />
      <ResetPasswordForm />
    </>
  );
}
