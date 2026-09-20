"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Section } from "../../_components/Section";
import { StatCards } from "./CardsShowcase";
import { InvoicesTable } from "./TableShowcase";

const TABLE_ROWS = 5;

function LoadingState() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((card) => (
          <Card key={card} className="flex flex-col gap-4 p-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-3 w-24" />
          </Card>
        ))}
      </div>
      <Card className="flex flex-col gap-5 p-6">
        {Array.from({ length: TABLE_ROWS }, (_, row) => (
          <div key={row} className="flex items-center gap-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </Card>
    </>
  );
}

export function SkeletonShowcase() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <Section
      title="Squelettes"
      description="Balayage lumineux pendant le chargement, jamais de spinner nu. Le contenu arrive ensuite : compteurs et lignes en cascade."
    >
      <div aria-busy={isLoading} className="flex flex-col gap-4">
        {isLoading ? (
          <LoadingState />
        ) : (
          <>
            <StatCards />
            <Card className="p-2">
              <InvoicesTable />
            </Card>
          </>
        )}
      </div>
      <Button variant="secondary" size="sm" className="w-fit" onClick={() => setIsLoading((loading) => !loading)}>
        {isLoading ? "Afficher le contenu" : "Revenir au chargement"}
      </Button>
    </Section>
  );
}
