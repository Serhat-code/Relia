import { z } from "zod";

/**
 * Tableau de bord (§5.7) : lecture de public.dashboard_summary(), calculée par la base sur les seules
 * factures de l'organisation. La synthèse porte sur la devise de travail de l'organisation ; les
 * factures libellées autrement sont comptées à part et jamais converties — additionner des devises
 * serait faux.
 */

/** Période du DSO : le facturé des 90 derniers jours sert de base. */
export const DSO_PERIOD_DAYS = 90;

export const AGING_BUCKETS = ["1 à 30 jours", "31 à 60 jours", "61 à 90 jours", "Plus de 90 jours"] as const;

const amount = z.coerce.number().finite().nonnegative();

const atRiskSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  amount_ttc: z.coerce.number().finite(),
  currency: z.string(),
  due_at: z.iso.date(),
  debtor_id: z.uuid(),
  debtor_name: z.string(),
  risk_score: z.number().int().nullable(),
});

const summarySchema = z.object({
  // Valeurs par défaut : le code peut être déployé avant que la migration ne soit appliquée.
  currency: z.string().length(3).default("EUR"),
  other_currency_count: z.number().int().nonnegative().default(0),
  open_amount: amount,
  open_count: z.number().int().nonnegative(),
  late_amount: amount,
  late_count: z.number().int().nonnegative(),
  promised_amount: amount,
  promised_count: z.number().int().nonnegative(),
  billed_90_days: amount,
  aging: z.array(amount).length(AGING_BUCKETS.length),
  at_risk: z.array(atRiskSchema),
});

export type AtRiskInvoice = {
  id: string;
  number: string;
  amountTtc: number;
  currency: string;
  dueAt: string;
  debtor: { id: string; name: string };
  riskScore: number | null;
};

export type AgingBucket = { label: (typeof AGING_BUCKETS)[number]; amount: number; share: number };

export type DashboardSummary = {
  /** Devise de travail de l'organisation : tous les montants ci-dessous sont libellés ainsi. */
  currency: string;
  /** Factures en cours dans une autre devise, volontairement exclues des totaux. */
  otherCurrencyCount: number;
  openAmount: number;
  openCount: number;
  lateAmount: number;
  lateCount: number;
  promisedAmount: number;
  promisedCount: number;
  /** Encours pas encore échu : ni en retard, ni sous promesse. */
  notDueAmount: number;
  /** Délai moyen d'encaissement en jours (DSO), ou null sans facturation récente. */
  dso: number | null;
  aging: AgingBucket[];
  atRisk: AtRiskInvoice[];
};

/**
 * DSO (Days Sales Outstanding) = encours ÷ facturé sur la période × jours de la période.
 * Sans facturation sur la période, il n'a pas de sens : null.
 */
export function computeDso(openAmount: number, billedOverPeriod: number, periodDays = DSO_PERIOD_DAYS): number | null {
  if (billedOverPeriod <= 0) return null;
  return Math.round((openAmount / billedOverPeriod) * periodDays);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function parseDashboardSummary(raw: unknown): DashboardSummary | null {
  const parsed = summarySchema.safeParse(raw);
  if (!parsed.success) return null;
  const data = parsed.data;
  const agingTotal = data.aging.reduce((sum, value) => sum + value, 0);

  return {
    currency: data.currency,
    otherCurrencyCount: data.other_currency_count,
    openAmount: data.open_amount,
    openCount: data.open_count,
    lateAmount: data.late_amount,
    lateCount: data.late_count,
    promisedAmount: data.promised_amount,
    promisedCount: data.promised_count,
    notDueAmount: Math.max(0, round2(data.open_amount - data.late_amount - data.promised_amount)),
    dso: computeDso(data.open_amount, data.billed_90_days),
    aging: AGING_BUCKETS.map((label, index) => {
      const value = data.aging[index] ?? 0;
      return { label, amount: value, share: agingTotal > 0 ? value / agingTotal : 0 };
    }),
    atRisk: data.at_risk.map((item) => ({
      id: item.id,
      number: item.number,
      amountTtc: item.amount_ttc,
      currency: item.currency,
      dueAt: item.due_at,
      debtor: { id: item.debtor_id, name: item.debtor_name },
      riskScore: item.risk_score,
    })),
  };
}
