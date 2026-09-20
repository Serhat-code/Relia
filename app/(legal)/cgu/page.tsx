import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { TERMS_SECTIONS, TERMS_VERSION } from "@/lib/legal/terms";

export const metadata: Metadata = {
  title: "Conditions générales",
  description: "Conditions générales d'utilisation et d'abonnement du service Relia.",
};

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Conditions générales"
      title="Conditions générales d'utilisation et d'abonnement"
      version={TERMS_VERSION}
      intro="Acceptées à l'inscription, avec l'accord de sous-traitance des données."
      isDraft
      sections={TERMS_SECTIONS}
    />
  );
}
