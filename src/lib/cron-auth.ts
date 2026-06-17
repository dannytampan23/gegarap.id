import { timingSafeEqual } from 'node:crypto';

/**
 * Authorise an inbound cron request. Vercel Cron attaches
 * `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set in the project
 * env. Without a secret configured we allow only outside production, so crons
 * are testable locally but never world-callable in prod.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';

  const header = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
