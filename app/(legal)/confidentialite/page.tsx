import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { PRIVACY_SECTIONS, PRIVACY_VERSION } from "@/lib/legal/privacy";

export const metadata: Metadata = {
  title: "Confidentialité",
  description: "Comment Relia traite les données de ses utilisateurs, et celles des clients de ses utilisateurs.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Données personnelles"
      title="Politique de confidentialité"
      version={PRIVACY_VERSION}
      isDraft
      sections={PRIVACY_SECTIONS}
    />
  );
}
