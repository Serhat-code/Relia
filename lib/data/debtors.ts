import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { InvoiceListItem } from "@/lib/data/invoices";
import type { ClientType } from "@/lib/debtors/client-type";
import type { DebtorInput } from "@/lib/debtors/debtor-form";
import { DEBTORS_PAGE_SIZE, type DebtorListQuery } from "@/lib/debtors/list-query";
import { daysOverdue, effectiveStatus, todayInParis } from "@/lib/invoices/dates";
import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DebtorSuggestion = { name: string; clientType: ClientType; siren: string | null; email: string | null };

const SUGGESTION_LIMIT = 500;

/** Clients déjà connus, pour compléter la saisie d'une facture. */
export async function listDebtorSuggestions(): Promise<DebtorSuggestion[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("debtors")
    .select("name, client_type, siren, contact_email")
    .order("name")
    .limit(SUGGESTION_LIMIT);
  if (error) throw new Error(`Lecture des clients impossible : ${error.message}`);
  return data.map((debtor) => ({
    name: debtor.name,
    clientType: debtor.client_type,
    siren: debtor.siren,
    email: debtor.contact_email,
  }));
}

// ─── Liste ──────────────────────────────────────────────────────────────────────

export type DebtorListItem = {
  id: string;
  name: string;
  clientType: ClientType;
  siren: string | null;
  isLegalEntity: boolean;
  contactEmail: string | null;
  riskScore: number | null;
  paymentBehaviorDays: number | null;
  invoiceCount: number;
  openAmount: number;
  lateAmount: number;
};

export type DebtorList = { items: DebtorListItem[]; total: number; pageCount: number };

export async function listDebtors({ filter, search, page }: DebtorListQuery): Promise<DebtorList> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_debtors", {
    ...(filter === "all" ? {} : { p_client_type: filter }),
    p_search: search,
    p_limit: DEBTORS_PAGE_SIZE,
    p_offset: (page - 1) * DEBTORS_PAGE_SIZE,
  });
  if (error) throw new Error(`Lecture des débiteurs impossible : ${error.message}`);

  const total = data[0]?.total_count ?? 0;
  return {
    items: data.map((row) => ({
      id: row.id,
      name: row.name,
      clientType: row.client_type,
      siren: row.siren ?? null,
      isLegalEntity: row.is_legal_entity,
      contactEmail: row.contact_email ?? null,
      riskScore: row.risk_score ?? null,
      paymentBehaviorDays: row.payment_behavior_days ?? null,
      invoiceCount: row.invoice_count,
      openAmount: Number(row.open_amount),
      lateAmount: Number(row.late_amount),
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / DEBTORS_PAGE_SIZE)),
  };
}

// ─── Fiche ──────────────────────────────────────────────────────────────────────

export type DebtorDetail = DebtorInput & {
  id: string;
  riskScore: number | null;
  paymentBehaviorDays: number | null;
  createdAt: string;
  invoices: InvoiceListItem[];
};

/** Au-delà, la fiche renvoie vers la liste des factures filtrée. */
const DEBTOR_INVOICES_LIMIT = 100;

const uuidSchema = z.uuid();

export const getDebtor = cache(async (id: string): Promise<DebtorDetail | null> => {
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("debtors")
    .select(
      `id, name, client_type, siren, is_legal_entity, contact_name, contact_email, phone, address, notes,
       risk_score, payment_behavior_days, created_at,
       invoices (id, number, amount_ttc, currency, issued_at, due_at, paid_at, status)`,
    )
    .eq("id", id)
    .order("due_at", { referencedTable: "invoices", ascending: false })
    .limit(DEBTOR_INVOICES_LIMIT, { referencedTable: "invoices" })
    .maybeSingle();
  if (error) throw new Error(`Lecture du débiteur impossible : ${error.message}`);
  if (!data) return null;

  const today = todayInParis();
  return {
    id: data.id,
    name: data.name,
    clientType: data.client_type,
    siren: data.siren,
    isLegalEntity: data.is_legal_entity,
    contactName: data.contact_name,
    contactEmail: data.contact_email,
    phone: data.phone,
    address: data.address,
    notes: data.notes,
    riskScore: data.risk_score,
    paymentBehaviorDays: data.payment_behavior_days,
    createdAt: data.created_at,
    invoices: data.invoices.map((invoice) => {
      const status = effectiveStatus(invoice.status, invoice.due_at, today);
      return {
        id: invoice.id,
        number: invoice.number,
        debtorId: data.id,
        debtorName: data.name,
        clientType: data.client_type,
        amountTtc: Number(invoice.amount_ttc),
        currency: invoice.currency,
        issuedAt: invoice.issued_at,
        dueAt: invoice.due_at,
        paidAt: invoice.paid_at,
        status,
        daysOverdue: status === "late" ? daysOverdue(invoice.due_at, today) : 0,
      };
    }),
  };
});

// ─── Écritures ──────────────────────────────────────────────────────────────────

export type DebtorMutationResult = { ok: true } | { ok: false; error: string };

export async function updateDebtor(id: string, input: DebtorInput): Promise<DebtorMutationResult> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Client introuvable." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("debtors")
    .update({
      name: input.name,
      client_type: input.clientType,
      siren: input.siren,
      is_legal_entity: input.isLegalEntity,
      contact_name: input.contactName,
      contact_email: input.contactEmail,
      phone: input.phone,
      address: input.address,
      notes: input.notes,
    })
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("Mise à jour d'un débiteur refusée par la base", { code: error.code, message: error.message });
    return { ok: false, error: "La fiche n'a pas pu être enregistrée." };
  }
  return data.length > 0 ? { ok: true } : { ok: false, error: "Client introuvable." };
}

/** Effacement (droit à l'effacement du débiteur) : réservé aux responsables, vérifié par la base. */
export async function deleteDebtor(id: string): Promise<DebtorMutationResult> {
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: "Client introuvable." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_debtor", { p_debtor_id: id });
  if (!error) return { ok: true };
  if (error.code === "42501") {
    return { ok: false, error: "Seuls le propriétaire et les administrateurs peuvent effacer un client." };
  }
  console.error("Effacement d'un débiteur refusé par la base", { code: error.code, message: error.message });
  return { ok: false, error: "L'effacement n'a pas pu être réalisé." };
}

/** Document d'export (droit d'accès du débiteur), ou null si le débiteur est introuvable. */
export async function exportDebtor(id: string): Promise<Json | null> {
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("export_debtor", { p_debtor_id: id });
  if (error?.code === "P0002") return null;
  if (error) throw new Error(`Export du débiteur impossible : ${error.message}`);
  return data;
}
