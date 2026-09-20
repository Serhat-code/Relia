import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { stubReducedMotion } from "@/tests/helpers/media";
import { ReliaLoader } from "./ReliaLoader";

const acquire = vi.hoisted(() => vi.fn(() => vi.fn()));
vi.mock("@/lib/brand/favicon-animation", () => ({ acquireFaviconAnimation: acquire }));

function loaderRoot(container: HTMLElement): HTMLElement {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error("Loader introuvable");
  return root;
}

describe("ReliaLoader", () => {
  it("annonce le chargement aux lecteurs d'écran", () => {
    render(<ReliaLoader />);

    expect(screen.getByRole("status")).toHaveTextContent("Chargement…");
  });

  it("accepte un libellé adapté au contexte", () => {
    render(<ReliaLoader label="Envoi de la relance…" />);

    expect(screen.getByRole("status")).toHaveTextContent("Envoi de la relance…");
  });

  it("annonce la fin et ferme l'anneau en état succès", () => {
    const { container, rerender } = render(<ReliaLoader />);

    rerender(<ReliaLoader state="success" />);

    expect(screen.getByRole("status")).toHaveTextContent("Terminé");
    expect(loaderRoot(container)).toHaveAttribute("data-state", "success");
  });

  it("revient en chargement après un succès", () => {
    const { container, rerender } = render(<ReliaLoader state="success" />);

    rerender(<ReliaLoader state="loading" />);

    expect(loaderRoot(container)).toHaveAttribute("data-state", "loading");
  });

  it("dessine quatre arcs, un par étape du cycle", () => {
    const { container } = render(<ReliaLoader />);

    expect(container.querySelectorAll("[data-stage]")).toHaveLength(4);
  });

  it("se masque aux technologies d'assistance quand il est décoratif", () => {
    const { container } = render(<ReliaLoader isDecorative />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(loaderRoot(container)).toHaveAttribute("aria-hidden", "true");
  });

  it.each([
    ["sm", "size-4"],
    ["md", "size-8"],
    ["lg", "size-16"],
  ] as const)("taille %s", (size, className) => {
    const { container } = render(<ReliaLoader size={size} />);

    expect(loaderRoot(container)).toHaveClass(className);
  });

  it("prend les couleurs de marque par défaut", () => {
    const { container } = render(<ReliaLoader />);

    const strokes = [...container.querySelectorAll("circle")].map((circle) => circle.getAttribute("stroke"));
    expect(strokes.every((stroke) => stroke?.startsWith("url(#"))).toBe(true);
  });

  it("ton « current » : suit la couleur du texte, pour rester visible sur un bouton plein", () => {
    const { container } = render(<ReliaLoader tone="current" />);

    const brandArcs = container.querySelectorAll('circle[stroke="currentColor"]');
    expect(brandArcs).toHaveLength(4);
    expect(loaderRoot(container)).toHaveAttribute("data-tone", "current");
  });

  it("peut forcer le mode mouvement réduit", () => {
    const { container } = render(<ReliaLoader isReducedMotion />);

    expect(loaderRoot(container)).toHaveAttribute("data-reduced-motion");
  });

  it("anime le favicon seulement pendant le chargement, sur demande", () => {
    acquire.mockClear();
    stubReducedMotion(true);
    const { rerender } = render(<ReliaLoader />);
    expect(acquire).not.toHaveBeenCalled();

    rerender(<ReliaLoader hasFaviconAnimation />);
    expect(acquire).toHaveBeenCalledWith(true);

    const release = acquire.mock.results[0]?.value as ReturnType<typeof vi.fn>;
    rerender(<ReliaLoader hasFaviconAnimation state="success" />);
    expect(release).toHaveBeenCalled();
  });
});
