import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReliaMark } from "./ReliaMark";

function arcOpacities(container: HTMLElement): Array<string | null> {
  return [...container.querySelectorAll("[data-stage]")].map((arc) => arc.getAttribute("opacity"));
}

describe("ReliaMark", () => {
  it("se présente comme l'image « Relia »", () => {
    render(<ReliaMark />);

    expect(screen.getByRole("img", { name: "Relia" })).toBeInTheDocument();
  });

  it("affiche les quatre arcs pleins par défaut", () => {
    const { container } = render(<ReliaMark />);

    expect(arcOpacities(container)).toEqual(["1", "1", "1", "1"]);
  });

  it("état payé : le quatrième arc (encaissement) est le seul plein", () => {
    const { container } = render(<ReliaMark stage="paid" />);

    expect(arcOpacities(container)).toEqual(["0.22", "0.22", "0.22", "1"]);
    expect(screen.getByRole("img", { name: "Relia — Encaissement" })).toBeInTheDocument();
  });

  it("peut être purement décoratif", () => {
    const { container } = render(<ReliaMark isDecorative />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
