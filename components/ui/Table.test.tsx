import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MAX_CASCADE_ROWS, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";

function renderRows(indexes: ReadonlyArray<number | undefined>) {
  return render(
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Facture</TableHead>
          <TableHead align="right">Montant</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {indexes.map((index, position) => (
          <TableRow key={position} index={index}>
            <TableCell>F-{position}</TableCell>
            <TableCell align="right">100</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>,
  );
}

describe("Table", () => {
  it("reste un vrai tableau accessible", () => {
    renderRows([0]);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Montant" })).toHaveClass("text-right");
    expect(screen.getByRole("cell", { name: "100" })).toHaveClass("text-right");
  });

  it("apparition en cascade : 40 ms par ligne, plafonnée", () => {
    renderRows([0, 3, 500]);
    const rows = screen.getAllByRole("row").slice(1);

    expect(rows.map((row) => row.style.animationDelay)).toEqual(["0ms", "120ms", `${MAX_CASCADE_ROWS * 40}ms`]);
  });

  it("sans index, aucune animation d'arrivée", () => {
    renderRows([undefined]);
    const [, row] = screen.getAllByRole("row");

    expect(row?.style.animationDelay).toBe("");
    expect(row?.className).not.toContain("animate-row-in");
  });
});
