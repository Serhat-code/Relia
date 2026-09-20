import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { DPA_SECTIONS, DPA_VERSION } from "@/lib/legal/dpa";

export const metadata: Metadata = {
  title: "Accord de sous-traitance des données (DPA)",
  description: "Accord de sous-traitance au sens de l'article 28 du RGPD, accepté à l'inscription sur Relia.",
};

export default function DpaPage() {
  return (
    <LegalDocument
      eyebrow="Article 28 du RGPD"
      title="Accord de sous-traitance des données"
      version={DPA_VERSION}
      intro="La version acceptée, sa date et l'adresse IP de l'acceptation sont conservées avec votre compte."
      isDraft
      sections={DPA_SECTIONS}
    >
      <p className="text-sm text-fg-muted">
        Liste à jour des sous-traitants ultérieurs :{" "}
        <Link href="/sous-traitants" className="font-medium text-link underline-offset-4 hover:underline">
          page Sous-traitants
        </Link>
        .
      </p>
    </LegalDocument>
  );
}
