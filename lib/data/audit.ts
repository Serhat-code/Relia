import "server-only";
import { z } from "zod";
import { entryLink, type JournalCategory } from "@/lib/audit/categories";
import { describeActor, describeAuditAction } from "@/lib/audit/describe";
import type { Enums, Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuditEntry = {
  id: number;
  createdAt: string;
  actor: string;
  description: string;
  /** Page de la facture ou du client concerné, s'il y en a une. */
  link: { href: string; label: string } | null;
};

const HISTORY_LIMIT = 50;
export const JOURNAL_PAGE_SIZE = 50;

const uuidSchema = z.uuid();

const AUDIT_COLUMNS = "id, actor_type, actor_id, action, entity_type, entity_id, payload, created_at";

type AuditRow = {
  id: number;
  actor_type: Enums<"actor_type">;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  payload: Json;
  created_at: string;
};

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Noms des membres de l'organisation (l'acteur d'une entrée est un identifiant). */
async function memberNames(supabase: Supabase): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("users").select("id, full_name, email");
  if (error) throw new Error(`Lecture des membres impossible : ${error.message}`);
  return new Map(data.map((member) => [member.id, member.full_name ?? member.email]));
}

function toEntries(rows: readonly AuditRow[], names: ReadonlyMap<string, string>): AuditEntry[] {
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    actor: describeActor(row.actor_type, row.actor_id ? (names.get(row.actor_id) ?? null) : null),
    description: describeAuditAction(row.action, row.payload),
    link: entryLink({ action: row.action, entityType: row.entity_type, entityId: row.entity_id, payload: row.payload }),
  }));
}

/**
 * Historique d'un élément (facture, débiteur…), le plus récent d'abord. Pour une facture, s'y ajoutent
 * les événements de ses relances (préparée, validée, envoyée…), qui portent son identifiant.
 */
export async function listEntityHistory(entityType: "invoice" | "debtor", entityId: string): Promise<AuditEntry[]> {
  // L'identifiant entre dans un filtre de l'API : il doit être un UUID.
  if (!uuidSchema.safeParse(entityId).success) return [];
  const supabase = await createSupabaseServerClient();
  const query = supabase.from("audit_logs").select(AUDIT_COLUMNS);
  const scoped =
    entityType === "invoice"
      ? query.or(`and(entity_type.eq.invoice,entity_id.eq.${entityId}),payload->>invoice_id.eq.${entityId}`)
      : query.eq("entity_type", entityType).eq("entity_id", entityId);
  const [logs, names] = await Promise.all([
    scoped
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(HISTORY_LIMIT),
    memberNames(supabase),
  ]);
  if (logs.error) throw new Error(`Lecture de l'historique impossible : ${logs.error.message}`);
  // L'historique d'un élément reste sur sa page : pas de lien vers lui-même.
  return toEntries(logs.data, names).map((entry) => ({ ...entry, link: null }));
}

export type JournalPage = { entries: AuditEntry[]; total: number; pageCount: number };

/** Journal de l'organisation (§5.8), filtré par thème, par pages, le plus récent d'abord. */
export async function listJournal(category: JournalCategory, page: number): Promise<JournalPage> {
  const supabase = await createSupabaseServerClient();
  const from = (Math.max(1, page) - 1) * JOURNAL_PAGE_SIZE;
  const query = supabase.from("audit_logs").select(AUDIT_COLUMNS, { count: "exact" });
  const filtered = category.filter ? query.or(category.filter) : query;
  const [logs, names] = await Promise.all([
    filtered
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + JOURNAL_PAGE_SIZE - 1),
    memberNames(supabase),
  ]);
  if (logs.error) throw new Error(`Lecture du journal impossible : ${logs.error.message}`);
  const total = logs.count ?? 0;
  return { entries: toEntries(logs.data, names), total, pageCount: Math.max(1, Math.ceil(total / JOURNAL_PAGE_SIZE)) };
}

/** Événements depuis un instant donné (activité du jour du tableau de bord). */
export async function listActivitySince(since: string, limit: number): Promise<AuditEntry[]> {
  const supabase = await createSupabaseServerClient();
  const [logs, names] = await Promise.all([
    supabase
      .from("audit_logs")
      .select(AUDIT_COLUMNS)
      .gte("created_at", since)
      // Les vérifications techniques (e-mail de test, lecture demandée) n'intéressent pas le tableau de bord.
      .not("action", "in", "(mailbox.tested,mailbox.smtp_checked,replies.checked)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit),
    memberNames(supabase),
  ]);
  if (logs.error) throw new Error(`Lecture de l'activité impossible : ${logs.error.message}`);
  return toEntries(logs.data, names);
}
