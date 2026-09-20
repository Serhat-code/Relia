import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field, Input, Select, Textarea } from "./Field";

describe("Field", () => {
  it("associe le libellé au champ", () => {
    render(
      <Field label="Numéro SIREN">
        <Input />
      </Field>,
    );

    expect(screen.getByLabelText("Numéro SIREN")).toBeInstanceOf(HTMLInputElement);
  });

  it("relie l'aide et l'erreur au champ, et le marque invalide", () => {
    render(
      <Field label="Numéro SIREN" hint="9 chiffres" error="Ce SIREN est invalide">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Numéro SIREN");

    expect(input).toHaveAccessibleDescription("9 chiffres Ce SIREN est invalide");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("sans erreur, le champ n'est pas marqué invalide", () => {
    render(
      <Field label="Nom">
        <Input />
      </Field>,
    );

    expect(screen.getByLabelText("Nom")).not.toHaveAttribute("aria-invalid");
  });

  it("marque le champ obligatoire", () => {
    render(
      <Field label="Nom du débiteur" isRequired>
        <Input />
      </Field>,
    );

    expect(screen.getByLabelText(/Nom du débiteur/)).toBeRequired();
  });

  it("fonctionne aussi avec une zone de texte et une liste", () => {
    render(
      <>
        <Field label="Notes">
          <Textarea />
        </Field>
        <Field label="Type de client">
          <Select>
            <option value="b2b">Professionnel</option>
            <option value="b2c">Particulier</option>
          </Select>
        </Field>
      </>,
    );

    expect(screen.getByLabelText("Notes")).toBeInstanceOf(HTMLTextAreaElement);
    expect(screen.getByLabelText("Type de client")).toBeInstanceOf(HTMLSelectElement);
  });
});
