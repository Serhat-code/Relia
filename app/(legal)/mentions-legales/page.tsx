import type { Metadata } from "next";
import { FormMessage } from "@/components/ui/FormMessage";
import { HOSTING, isPublisherComplete, PUBLISHER } from "@/lib/legal/publisher";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Éditeur du site Relia, directeur de la publication et hébergement.",
};

const TO_COMPLETE = "à compléter";

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-6">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className={value ? "text-sm text-fg" : "text-sm text-fg-muted italic"}>{value ?? TO_COMPLETE}</dd>
    </div>
  );
}

export default function LegalNoticePage() {
  const publisher = PUBLISHER;

  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-[0.2em] text-fg-muted uppercase">Loi n° 2004-575 du 21 juin 2004</p>
        <h1 className="text-2xl font-semibold">Mentions légales</h1>
        {!isPublisherComplete(publisher) && (
          <FormMessage tone="info">Les informations de l&apos;éditeur seront complétées avant l&apos;ouverture du service.</FormMessage>
        )}
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Éditeur</h2>
        <dl className="divide-y divide-border">
          <Row label="Raison sociale" value={publisher.companyName} />
          <Row label="Forme juridique et capital" value={publisher.legalForm && publisher.shareCapital && `${publisher.legalForm}, capital de ${publisher.shareCapital}`} />
          <Row label="SIREN et RCS" value={publisher.siren && publisher.rcsCity && `${publisher.siren}, RCS ${publisher.rcsCity}`} />
          <Row label="TVA intracommunautaire" value={publisher.vatNumber} />
          <Row label="Siège social" value={publisher.address} />
          <Row label="Directeur de la publication" value={publisher.publicationDirector} />
          <Row label="Contact" value={publisher.contactEmail} />
          <Row label="Données personnelles" value={publisher.privacyEmail} />
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Hébergement</h2>
        <dl className="divide-y divide-border">
          {HOSTING.map((host) => (
            <Row key={host.role} label={host.role} value={[host.name, host.address, host.detail].filter(Boolean).join(" — ")} />
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Propriété intellectuelle</h2>
        <p className="text-base leading-relaxed text-fg-muted">
          La marque Relia, son logo et les contenus du site sont protégés. Toute reproduction sans autorisation est interdite.
        </p>
      </section>
    </article>
  );
}
