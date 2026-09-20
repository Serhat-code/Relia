import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatCurrency } from "@/lib/format";
import { stubReducedMotion } from "@/tests/helpers/media";
import { StatCard } from "./StatCard";

describe("StatCard", () => {
  it("donne le libellé et la valeur finale aux lecteurs d'écran, jamais les valeurs intermédiaires", () => {
    const { container } = render(<StatCard label="Encours total" value={48230} format="currency" />);

    expect(screen.getByText("Encours total")).toBeInTheDocument();
    // Comparaison brute : le montant contient des espaces insécables que Testing Library normaliserait.
    expect(container.querySelector(".sr-only")?.textContent).toBe(formatCurrency(48230));
    expect(container.querySelector("[data-counter]")).toHaveAttribute("aria-hidden", "true");
  });

  it("mouvement réduit : affiche directement la valeur finale", () => {
    stubReducedMotion(true);

    const { container } = render(<StatCard label="DSO" value={52} format="days" />);

    expect(container.querySelector("[data-counter]")).toHaveTextContent("52 jours");
  });

  it("sans valeur calculable, affiche un tiret et le dit aux lecteurs d'écran", () => {
    render(<StatCard label="DSO" value={null} format="days" />);

    expect(screen.getByText("Non disponible")).toBeInTheDocument();
    expect(screen.getByText("—")).toHaveAttribute("aria-hidden");
  });
});
