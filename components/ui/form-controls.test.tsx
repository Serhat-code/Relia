import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CheckboxField } from "./CheckboxField";
import { Field } from "./Field";
import { FormMessage } from "./FormMessage";
import { PasswordInput } from "./PasswordInput";

describe("PasswordInput", () => {
  it("masque le mot de passe, et l'affiche à la demande", async () => {
    render(
      <Field label="Mot de passe">
        <PasswordInput name="password" />
      </Field>,
    );
    const input = screen.getByLabelText("Mot de passe");
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Afficher le mot de passe" }));

    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Masquer le mot de passe" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("CheckboxField", () => {
  it("relie la case à son libellé et à son erreur", () => {
    render(<CheckboxField name="dpaAccepted" label="J'accepte le DPA" error="Obligatoire." />);
    const checkbox = screen.getByRole("checkbox", { name: "J'accepte le DPA" });

    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox).toHaveAccessibleDescription("Obligatoire.");
  });

  it("envoie « on » quand elle est cochée", async () => {
    render(<CheckboxField name="dpaAccepted" label="J'accepte" />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("checkbox")).toHaveAttribute("name", "dpaAccepted");
  });
});

describe("FormMessage", () => {
  it("une erreur est annoncée immédiatement, un succès poliment", () => {
    const { rerender } = render(<FormMessage tone="error">Échec</FormMessage>);
    expect(screen.getByRole("alert")).toHaveTextContent("Échec");

    rerender(<FormMessage tone="success">Envoyé</FormMessage>);
    expect(screen.getByRole("status")).toHaveTextContent("Envoyé");
  });
});
