import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast/ToastProvider";
import type { ReplyItem } from "@/lib/data/replies";

const resolveReplyAction = vi.fn(async () => ({ ok: true as const, message: "Relances reprises pour cette facture." }));

vi.mock("@/app/app/reponses/actions", () => ({
  resolveReplyAction: (...args: unknown[]) => resolveReplyAction(...(args as [])),
  recordPromiseAction: vi.fn(async () => ({ ok: true, message: "Promesse enregistrée." })),
}));

const { ReplyCard } = await import("./ReplyCard");

const REPLY: ReplyItem = {
  id: "00000000-0000-4000-8000-000000000201",
  kind: "dispute",
  status: "new",
  receivedAt: "2026-09-21T08:42:00Z",
  excerpt: "Nous contestons le montant.",
  isAiClassified: true,
  handledAt: null,
  invoice: {
    id: "00000000-0000-4000-8000-000000000412",
    number: "F-2026-0412",
    amountTtc: 4820,
    currency: "EUR",
    dueAt: "2026-08-11",
    status: "late",
    isPaused: true,
  },
  debtor: { id: "00000000-0000-4000-8000-000000000001", name: "Menuiserie Caradec", email: "compta@caradec.example" },
  promise: null,
};

const renderCard = (reply: Partial<ReplyItem> = {}) =>
  render(
    <ToastProvider>
      <ReplyCard reply={{ ...REPLY, ...reply }} today="2026-09-21" />
    </ToastProvider>,
  );

const button = (name: string) => screen.queryByRole("button", { name });

describe("ReplyCard", () => {
  it("montre l'extrait, le type de réponse et la mention d'analyse par IA", () => {
    renderCard();

    expect(screen.getByText("Nous contestons le montant.")).toBeInTheDocument();
    expect(screen.getByText("Contestation")).toBeInTheDocument();
    expect(screen.getByText("Analyse assistée par IA")).toBeInTheDocument();
  });

  it("propose de signaler un litige pour une contestation", () => {
    renderCard();

    expect(button("Signaler un litige")).toBeInTheDocument();
    expect(button("Marquer comme payée")).not.toBeInTheDocument();
    expect(button("Reprendre les relances")).toBeInTheDocument();
    expect(button("Garder en pause")).toBeInTheDocument();
  });

  it("propose de noter le règlement quand le client dit avoir payé", () => {
    renderCard({ kind: "paid_claim" });

    expect(button("Marquer comme payée")).toBeInTheDocument();
    expect(button("Signaler un litige")).not.toBeInTheDocument();
  });

  it("renvoie vers la fiche du client quand l'adresse est injoignable", () => {
    renderCard({ kind: "bounce", excerpt: null });

    expect(screen.getByRole("link", { name: "Corriger l'adresse" })).toHaveAttribute(
      "href",
      "/app/debiteurs/00000000-0000-4000-8000-000000000001",
    );
    expect(button("Noter une promesse")).not.toBeInTheDocument();
  });

  it("sur une facture déjà réglée, ne propose que de classer la réponse", () => {
    renderCard({ invoice: { ...REPLY.invoice, status: "paid", isPaused: false } });

    expect(button("Classer")).toBeInTheDocument();
    expect(button("Reprendre les relances")).not.toBeInTheDocument();
    expect(button("Signaler un litige")).not.toBeInTheDocument();
    expect(button("Noter une promesse")).not.toBeInTheDocument();
  });

  it("une promesse notée d'office se confirme, se corrige, ou s'abandonne en reprenant les relances", () => {
    renderCard({
      kind: "promise",
      invoice: { ...REPLY.invoice, status: "promised", isPaused: false },
      promise: { date: "2026-09-30", amount: null, kept: null },
    });

    expect(screen.getByText(/Relia a noté la promesse/)).toBeInTheDocument();
    expect(button("C'est noté")).toBeInTheDocument();
    expect(button("Corriger la promesse")).toBeInTheDocument();
    expect(button("Reprendre les relances")).toBeInTheDocument();
    expect(button("Garder en pause")).not.toBeInTheDocument();
  });

  it("une promesse que Relia n'a pas notée invite à la saisir", () => {
    renderCard({ kind: "promise" });

    expect(screen.getByText(/n'a pas noté de promesse/)).toBeInTheDocument();
    expect(button("Noter une promesse")).toBeInTheDocument();
    expect(button("Garder en pause")).toBeInTheDocument();
  });

  it("une réponse traitée n'a plus d'actions et montre la promesse enregistrée", () => {
    renderCard({
      kind: "promise",
      status: "handled",
      handledAt: "2026-09-21T09:00:00Z",
      promise: { date: "2026-09-30", amount: 600, kept: null },
    });

    expect(screen.getByText(/Promesse enregistrée/)).toHaveTextContent("600,00 € le 30/09/2026");
    expect(screen.getByText(/Traitée le/)).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("transmet la décision du membre et confirme par une notification", async () => {
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Reprendre les relances" }));

    await waitFor(() => expect(resolveReplyAction).toHaveBeenCalledWith({ replyId: REPLY.id, resolution: "resume", paidAt: null }));
    expect(await screen.findByText("Relances reprises pour cette facture.")).toBeInTheDocument();
  });
});
