"use client";

import { CalendarClock, ClockAlert, Wallet } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Section } from "../../_components/Section";

export function StatCards() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <StatCard label="Encours total" value={48230} format="currency" icon={<Wallet />} hint="38 factures ouvertes" />
      <StatCard
        label="Montant en retard"
        value={12480}
        format="currency"
        tone="danger"
        icon={<ClockAlert />}
        hint="9 factures, dont 3 à risque"
      />
      <StatCard label="DSO" value={52} format="days" icon={<CalendarClock />} hint="−6 jours sur 90 jours" />
    </div>
  );
}

export function CardsShowcase() {
  const [replayKey, setReplayKey] = useState(0);

  return (
    <Section
      title="Cartes"
      description="Cartes de statistiques : compteur animé au montage, dégradé qui dérive lentement en fond. Au premier rendu serveur, la vraie valeur s'affiche d'emblée."
    >
      <StatCards key={replayKey} />
      <Button variant="secondary" size="sm" className="w-fit" onClick={() => setReplayKey((key) => key + 1)}>
        Rejouer les compteurs
      </Button>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scénario B2B par défaut</CardTitle>
            <CardDescription>4 étapes, de J−3 à J+30 après l&apos;échéance.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-fg-muted">
            Courtois avant l&apos;échéance, ferme à J+15, mise en demeure factuelle à J+30.
          </CardContent>
          <CardFooter>
            <Button size="sm" variant="secondary">
              Modifier les étapes
            </Button>
          </CardFooter>
        </Card>
        <Card isInteractive className="flex flex-col justify-center gap-2 p-6">
          <p className="font-medium">Carte interactive</p>
          <p className="text-sm text-fg-muted">Survolez-la : halo de bordure.</p>
        </Card>
      </div>
    </Section>
  );
}
