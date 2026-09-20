import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { todayInParis } from "@/lib/invoices/dates";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/lib/invoices/status";
import { nextStatus, type StatusAction } from "@/lib/invoices/transitions";
import { DB_TEST_TIMEOUT_MS, asUser, createDatabase } from "./database";
import { createTenant, insertDebtor, type Tenant } from "./fixtures";

const ACTIONS: readonly StatusAction[] = ["mark_paid", "mark_disputed", "cancel", "reopen"];
const DUE_AT = "2026-01-31";

/** La base applique exactement les transitions de lib/invoices/transitions.ts. */
describe("changement de statut : parité entre l'application et la base", () => {
  let db: PGlite;
  let tenant: Tenant;
  let debtorId: string;
  let counter = 0;

  const invoiceWithStatus = async (status: InvoiceStatus) => {
    counter += 1;
    const { rows } = await db.query<{ id: string }>(
      `insert into invoices (organization_id, debtor_id, number, amount_ht, amount_ttc, issued_at, due_at, status, paid_at)
       values ($1, $2, $3, 100, 120, '2026-01-01', $4, $5::invoice_status,
         case when $5::text = 'paid' then date '2026-02-10' end) returning id`,
      [tenant.organizationId, debtorId, `P-${counter}`, DUE_AT, status],
    );
    return rows[0]?.id ?? "";
  };

  beforeAll(async () => {
    db = await createDatabase();
    tenant = await createTenant(db, "Atelier Parité");
    debtorId = await insertDebtor(db, tenant.organizationId);
  }, DB_TEST_TIMEOUT_MS);

  afterAll(() => db?.close());

  const cases = INVOICE_STATUSES.flatMap((status) => ACTIONS.map((action) => [status, action] as const));

  it.each(cases)("depuis « %s », l'action « %s » a le même résultat", async (status, action) => {
    const invoiceId = await invoiceWithStatus(status);
    const paidAt = action === "mark_paid" ? "2026-02-15" : null;
    const expected = nextStatus(action, { status, dueAt: DUE_AT }, todayInParis(), paidAt);

    const attempt = asUser(db, tenant.userId, async (tx) => {
      const { rows } = await tx.query<{ status: InvoiceStatus }>(
        "select public.change_invoice_status($1, $2, $3) as status",
        [invoiceId, action, paidAt],
      );
      return rows[0]?.status;
    });

    if (expected.ok) await expect(attempt).resolves.toBe(expected.status);
    else await expect(attempt).rejects.toThrow(/Action impossible/);
  });

  it("refuse une date de règlement dans le futur", async () => {
    const invoiceId = await invoiceWithStatus("late");

    await expect(
      asUser(db, tenant.userId, (tx) =>
        tx.query("select public.change_invoice_status($1, 'mark_paid', current_date + 5)", [invoiceId]),
      ),
    ).rejects.toThrow(/futur/);
  });
});
