import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgingBucket } from "@/lib/dashboard/summary";
import { AgingChart } from "./AgingChart";

const BUCKETS: AgingBucket[] = [
  { label: "1 à 30 jours", amount: 600, share: 0.6 },
  { label: "31 à 60 jours", amount: 300, share: 0.3 },
  { label: "61 à 90 jours", amount: 0, share: 0 },
  { label: "Plus de 90 jours", amount: 100, share: 0.1 },
];

describe("AgingChart", () => {
  it("écrit chaque tranche et sa part du retard, lue par les lecteurs d'écran", () => {
    render(<AgingChart buckets={BUCKETS} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("1 à 30 jours");
    expect(items[0]).toHaveTextContent("soit 60 % du montant en retard");
  });

  it("dimensionne les barres par rapport à la plus grande tranche, sans barre pour une tranche vide", () => {
    const { container } = render(<AgingChart buckets={BUCKETS} />);

    const bars = container.querySelectorAll<HTMLElement>("li span.bg-accent");
    expect([...bars].map((bar) => bar.style.width)).toEqual(["100%", "50%", "16.666666666666664%"]);
  });
});
