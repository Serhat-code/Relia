import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast, type ToastApi } from "./ToastProvider";

function Trigger({ run }: { run: (toast: ToastApi) => void }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => run(toast)}>
      Déclencher
    </button>
  );
}

function renderWithToasts(run: (toast: ToastApi) => void) {
  render(
    <ToastProvider>
      <Trigger run={run} />
    </ToastProvider>,
  );
  return () =>
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Déclencher" }));
    });
}

describe("ToastProvider", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("affiche une notification dans la zone annoncée aux lecteurs d'écran", async () => {
    const trigger = renderWithToasts((toast) => toast.show({ tone: "info", title: "Import terminé" }));

    await trigger();

    expect(screen.getByRole("region", { name: "Notifications" })).toHaveTextContent("Import terminé");
  });

  it("se ferme seule après son délai", async () => {
    vi.useFakeTimers();
    const trigger = renderWithToasts((toast) => toast.show({ tone: "success", title: "Relance envoyée" }));

    await trigger();
    expect(screen.getByText("Relance envoyée", { selector: "p" })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(screen.queryByText("Relance envoyée", { selector: "p" })).not.toBeInTheDocument();
  });

  it("le survol met le compte à rebours en pause, sans le remettre à zéro", async () => {
    vi.useFakeTimers();
    const trigger = renderWithToasts((toast) => toast.show({ tone: "info", title: "Import terminé" }));
    await trigger();
    const region = screen.getByRole("region", { name: "Notifications" });

    await act(() => vi.advanceTimersByTimeAsync(3000));
    fireEvent.mouseEnter(region);
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(screen.getByText("Import terminé", { selector: "p" })).toBeInTheDocument();

    fireEvent.mouseLeave(region);
    await act(() => vi.advanceTimersByTimeAsync(1900));
    expect(screen.getByText("Import terminé", { selector: "p" })).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(screen.queryByText("Import terminé", { selector: "p" })).not.toBeInTheDocument();
  });

  it("annonce les notifications aux lecteurs d'écran par une zone persistante", async () => {
    const trigger = renderWithToasts((toast) =>
      toast.show({ tone: "success", title: "Promesse enregistrée", description: "Règlement le 30/09." }),
    );

    await trigger();

    expect(screen.getByRole("status")).toHaveTextContent("Promesse enregistrée. Règlement le 30/09.");
  });

  it("se ferme avec son bouton", async () => {
    const trigger = renderWithToasts((toast) => toast.show({ tone: "info", title: "Synchronisé" }));

    await trigger();
    fireEvent.click(screen.getByRole("button", { name: "Fermer la notification" }));

    await waitFor(() => expect(screen.queryByText("Synchronisé", { selector: "p" })).not.toBeInTheDocument());
  });

  it("promise : chargement puis succès, le même loader passe en succès", async () => {
    let resolveTask: (value: string) => void = () => undefined;
    const task = new Promise<string>((resolve) => {
      resolveTask = resolve;
    });
    const trigger = renderWithToasts((toast) => {
      void toast.promise(task, { loading: "Envoi de la relance…", success: "Relance envoyée", error: "Échec" });
    });

    await trigger();
    const loader = screen.getByText("Envoi de la relance…", { selector: "p" }).closest("li")?.querySelector("[data-state]");
    expect(loader).toHaveAttribute("data-state", "loading");

    await act(async () => resolveTask("ok"));
    expect(screen.getByText("Relance envoyée", { selector: "p" })).toBeInTheDocument();
    expect(loader).toHaveAttribute("data-state", "success");
  });

  it("une erreur est annoncée immédiatement (role alert)", async () => {
    const trigger = renderWithToasts((toast) => toast.show({ tone: "error", title: "Boîte déconnectée" }));

    await trigger();

    expect(screen.getByRole("alert")).toHaveTextContent("Boîte déconnectée");
  });

  it("useToast hors du fournisseur lève une erreur explicite", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<Trigger run={() => undefined} />)).toThrow(/ToastProvider/);
  });
});
