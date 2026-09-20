import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionState } from "@/lib/data/session";
import { AuthHeading } from "../../_components/AuthHeading";
import { FinalizeSignupForm } from "../../_components/FinalizeSignupForm";

export const metadata: Metadata = { title: "Finaliser l'inscription" };

/** Compte créé mais organisation absente (inscription interrompue) : on la termine ici. */
export default async function FinalizeSignupPage() {
  const session = await getSessionState();
  if (session.kind === "anonymous") redirect("/connexion");
  if (session.kind === "member") redirect("/app");

  return (
    <>
      <AuthHeading
        title="Finaliser votre inscription"
        description="Il ne manque que votre entreprise et l'acceptation de l'accord de sous-traitance."
      />
      <FinalizeSignupForm />
    </>
  );
}
