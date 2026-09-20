import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Appels de cron (Vercel Cron, région cdg1) : autorisés seulement avec le secret CRON_SECRET, que
 * Vercel transmet dans l'en-tête Authorization. Sans secret configuré, tout appel est refusé.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
