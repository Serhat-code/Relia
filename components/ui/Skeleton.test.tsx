import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("est ignoré des lecteurs d'écran : c'est le conteneur qui annonce le chargement", () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild).toHaveClass("h-4", "w-32");
  });
});
