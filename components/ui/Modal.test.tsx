import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

/** Parent réaliste : onClose stable (useCallback) qui referme vraiment la modale. */
function ControlledModal({ onClose }: { onClose: () => void }) {
  const [isOpen, setIsOpen] = useState(true);
  const handleClose = useCallback(() => {
    onClose();
    setIsOpen(false);
  }, [onClose]);
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Confirmer l'envoi"
      description="La relance partira de votre boîte."
    >
      <p>Contenu</p>
    </Modal>
  );
}

function openModal(onClose = vi.fn()) {
  const view = render(<ControlledModal onClose={onClose} />);
  return { ...view, onClose, dialog: screen.getByRole("dialog", { name: "Confirmer l'envoi" }) };
}

describe("Modal", () => {
  it("fermée, le dialogue n'est pas ouvert", () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="Titre">
        Contenu
      </Modal>,
    );

    expect(container.querySelector("dialog")).toHaveProperty("open", false);
  });

  it("ouverte : dialogue modal nommé par son titre et décrit", () => {
    const { dialog } = openModal();

    expect(dialog).toHaveProperty("open", true);
    expect(dialog).toHaveAccessibleDescription("La relance partira de votre boîte.");
  });

  it("le bouton Fermer appelle onClose une seule fois", async () => {
    const { onClose } = openModal();

    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("un clic sur le fond ferme (une seule fois), un clic dans le contenu non", () => {
    const { dialog, onClose } = openModal();

    fireEvent.click(screen.getByText("Contenu"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("appelle toujours la dernière version de onClose, sans se réabonner", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(
      <Modal isOpen onClose={first} title="Titre">
        Contenu
      </Modal>,
    );
    rerender(
      <Modal isOpen onClose={latest} title="Titre">
        Contenu
      </Modal>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });

  it("une fermeture native (touche Échap) prévient le parent", () => {
    const { dialog, onClose } = openModal();

    (dialog as HTMLDialogElement).close();

    expect(onClose).toHaveBeenCalled();
  });
});
