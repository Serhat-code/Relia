import type { PaidPlan } from "./plans";

/**
 * Limites annoncées par les offres. **Elles avertissent, elles ne bloquent pas** : une TPE qui
 * dépasse le soir d'un gros import doit pouvoir continuer à relancer, pas se retrouver à la porte
 * de son propre outil. Le dépassement se dit clairement et propose l'offre au-dessus.
 *
 * Ces chiffres sont la source unique : les lignes affichées sur la page tarifs en sont dérivées
 * (`planFeatures`), pour que l'annonce commerciale et le décompte ne puissent pas diverger.
 */

export type PlanLimits = {
  users: number;
  /** Factures suivies, c'est-à-dire en cours : réglées, annulées et contestées ne comptent pas. */
  invoices: number | null;
};

export const PLAN_LIMITS: Readonly<Record<PaidPlan, PlanLimits>> = {
  starter: { users: 1, invoices: 150 },
  pro: { users: 3, invoices: 600 },
  business: { users: 10, invoices: null },
};

export type PlanUsage = { users: number; invoices: number };

export type LimitOverrun = {
  kind: "users" | "invoices";
  used: number;
  allowed: number;
  /** Phrase complète, à afficher telle quelle. */
  message: string;
};

const USERS_LABEL = (count: number) => `${count} ${count === 1 ? "utilisateur" : "utilisateurs"}`;

/**
 * Le dépassement le plus parlant, ou null. Un seul message à la fois : deux avertissements
 * simultanés se neutralisent. Les utilisateurs passent avant les factures — c'est la limite qu'on
 * franchit en invitant quelqu'un, donc celle dont on comprend immédiatement la cause.
 */
export function findLimitOverrun(plan: PaidPlan, usage: PlanUsage): LimitOverrun | null {
  const limits = PLAN_LIMITS[plan];

  if (usage.users > limits.users) {
    return {
      kind: "users",
      used: usage.users,
      allowed: limits.users,
      message: `Votre équipe compte ${USERS_LABEL(usage.users)}, et l'offre en prévoit ${USERS_LABEL(limits.users)}.`,
    };
  }
  if (limits.invoices !== null && usage.invoices > limits.invoices) {
    return {
      kind: "invoices",
      used: usage.invoices,
      allowed: limits.invoices,
      message: `Vous suivez ${usage.invoices} factures en cours, et l'offre en prévoit ${limits.invoices}.`,
    };
  }
  return null;
}

/** Lignes affichées sous chaque offre, dérivées des limites pour qu'elles restent vraies. */
export function planFeatures(plan: PaidPlan): readonly string[] {
  const limits = PLAN_LIMITS[plan];
  return [
    USERS_LABEL(limits.users),
    limits.invoices === null ? "Factures suivies sans limite" : `Jusqu'à ${limits.invoices} factures suivies`,
  ];
}
