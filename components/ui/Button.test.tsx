import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { buttonClasses } from "./button-styles";

describe("Button", () => {
  it("est de type « button » par défaut, pour ne jamais soumettre un formulaire par accident", () => {
    render(<Button>Envoyer</Button>);

    expect(screen.getByRole("button", { name: "Envoyer" })).toHaveAttribute("type", "button");
  });

  it("déclenche onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Envoyer</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("pendant l'action : occupé, inactif, loader intégré, clic ignoré", async () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button status="loading" onClick={onClick}>
        Envoyer
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Envoyer" });

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(onClick).not.toHaveBeenCalled();
    expect(container.querySelector('[data-state="loading"]')).toBeInTheDocument();
  });

  it("ne soumet pas le formulaire pendant l'action", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <Button type="submit" status="loading">
          Envoyer
        </Button>
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("affiche le libellé de chargement fourni", () => {
    render(
      <Button status="loading" loadingLabel="Envoi…">
        Envoyer
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Envoi…" })).toBeInTheDocument();
  });

  it("le même loader passe en succès, sans être remonté", () => {
    const { container, rerender } = render(<Button status="loading">Envoyer</Button>);
    const loader = container.querySelector("[data-state]");

    rerender(<Button status="success">Envoyer</Button>);

    expect(container.querySelector("[data-state]")).toBe(loader);
    expect(loader).toHaveAttribute("data-state", "success");
  });

  it("loader couleur du texte sur fond plein, couleurs de marque sinon", () => {
    const { container, rerender } = render(<Button status="loading">Envoyer</Button>);
    expect(container.querySelector("[data-tone]")).toHaveAttribute("data-tone", "current");

    rerender(
      <Button status="loading" variant="secondary">
        Envoyer
      </Button>,
    );
    expect(container.querySelector("[data-tone]")).toHaveAttribute("data-tone", "brand");
  });

  it("la classe passée l'emporte sur la taille par défaut", () => {
    render(<Button className="h-12">Envoyer</Button>);
    const button = screen.getByRole("button", { name: "Envoyer" });

    expect(button).toHaveClass("h-12");
    expect(button).not.toHaveClass("h-10");
  });

  it("buttonClasses permet de donner l'apparence d'un bouton à un lien", () => {
    expect(buttonClasses({ variant: "secondary", size: "sm" })).toContain("h-8");
  });
});
