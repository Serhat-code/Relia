import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { INVOICE_STATUS_LABELS, INVOICE_STATUSES } from "@/lib/invoices/status";
import { InvoiceStatusBadge } from "../invoices/InvoiceStatusBadge";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("affiche son libellé avec une pastille colorée", () => {
    const { container } = render(<Badge tone="success">Payée</Badge>);

    expect(screen.getByText("Payée")).toBeInTheDocument();
    expect(container.querySelector("[data-dot]")).toBeInTheDocument();
  });

  it("ne pulse que sur demande", () => {
    const { container, rerender } = render(<Badge tone="danger">En retard</Badge>);
    expect(container.querySelector("[data-pulse]")).not.toBeInTheDocument();

    rerender(
      <Badge tone="danger" hasPulse>
        En retard
      </Badge>,
    );
    expect(container.querySelector("[data-pulse]")).toBeInTheDocument();
  });
});

describe("InvoiceStatusBadge", () => {
  it.each(INVOICE_STATUSES)("statut « %s » : libellé français", (status) => {
    render(<InvoiceStatusBadge status={status} />);

    expect(screen.getByText(INVOICE_STATUS_LABELS[status])).toBeInTheDocument();
  });

  it("seul le statut « en retard » pulse", () => {
    const pulsing = INVOICE_STATUSES.filter((status) => {
      const { container, unmount } = render(<InvoiceStatusBadge status={status} />);
      const hasPulse = container.querySelector("[data-pulse]") !== null;
      unmount();
      return hasPulse;
    });

    expect(pulsing).toEqual(["late"]);
  });
});
