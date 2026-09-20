import type { PGlite } from "@electric-sql/pglite";

/** Jeux de données de test, insérés en superutilisateur (comme le ferait le serveur à l'inscription). */

export type Tenant = { organizationId: string; userId: string };

async function returningId(db: PGlite, sql: string, params: unknown[]): Promise<string> {
  const result = await db.query<{ id: string }>(sql, params);
  const id = result.rows[0]?.id;
  if (!id) throw new Error(`Aucun identifiant renvoyé : ${sql}`);
  return id;
}

export async function createTenant(db: PGlite, name: string): Promise<Tenant> {
  const userId = crypto.randomUUID();
  const email = `${userId}@test.relia.local`;
  await db.query("insert into auth.users (id, email) values ($1, $2)", [userId, email]);
  const organizationId = await returningId(
    db,
    `insert into public.organizations (name, dpa_accepted_at, dpa_version, dpa_ip)
     values ($1, now(), '2026-09', '203.0.113.10') returning id`,
    [name],
  );
  await db.query("insert into public.users (id, organization_id, email, role) values ($1, $2, $3, 'owner')", [
    userId,
    organizationId,
    email,
  ]);
  return { organizationId, userId };
}

/** Ajoute un membre à une organisation existante et renvoie son identifiant. */
export async function addMember(db: PGlite, organizationId: string, role: "owner" | "admin" | "member" = "member") {
  const userId = crypto.randomUUID();
  const email = `${userId}@test.relia.local`;
  await db.query("insert into auth.users (id, email) values ($1, $2)", [userId, email]);
  await db.query("insert into public.users (id, organization_id, email, role) values ($1, $2, $3, $4)", [
    userId,
    organizationId,
    email,
    role,
  ]);
  return userId;
}

type DebtorOptions = {
  clientType?: "b2b" | "b2c";
  siren?: string | null;
  isLegalEntity?: boolean;
};

export function insertDebtor(
  db: PGlite,
  organizationId: string,
  { clientType = "b2b", siren = "123456789", isLegalEntity = true }: DebtorOptions = {},
): Promise<string> {
  return returningId(
    db,
    `insert into public.debtors (organization_id, name, client_type, siren, is_legal_entity)
     values ($1, 'Débiteur de test', $2, $3, $4) returning id`,
    [organizationId, clientType, siren, isLegalEntity],
  );
}

export function insertInvoice(db: PGlite, organizationId: string, debtorId: string, number = "F-TEST-1"): Promise<string> {
  return returningId(
    db,
    `insert into public.invoices (organization_id, debtor_id, number, amount_ht, amount_ttc, issued_at, due_at)
     values ($1, $2, $3, 1000, 1200, '2026-08-01', '2026-08-31') returning id`,
    [organizationId, debtorId, number],
  );
}

export function insertSequence(db: PGlite, organizationId: string, clientType: "b2b" | "b2c" = "b2b"): Promise<string> {
  return returningId(
    db,
    `insert into public.reminder_sequences (organization_id, name, client_type) values ($1, 'Scénario', $2) returning id`,
    [organizationId, clientType],
  );
}
