/**
 * Fixed-window rate limiter with two backends:
 *
 *  1. Upstash Redis (REST) — used automatically when UPSTASH_REDIS_REST_URL and
 *     UPSTASH_REDIS_REST_TOKEN are set. This is an AUTHORITATIVE cross-instance
 *     limit, which is what serverless (Vercel) needs: each lambda no longer keeps
 *     its own private counter, so the cap holds globally.
 *  2. In-memory fallback — best-effort and PER-INSTANCE; used in dev or when
 *     Upstash isn't configured. It slows abuse but isn't a hard global guarantee.
 *
 * If an Upstash request errors (network blip), we fall back to the in-memory
 * counter rather than failing the user's request.
 *
 * `rateLimit` is async (the Redis backend does network I/O). Callers must await.
 */

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { RateLimitedError, ServiceUnavailableError } from '@/lib/errors';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  /** Requests left in the current window. */
  remaining: number;
  /** Seconds until the window resets (0 when not limited). */
  retryAfter: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

/** Reads the caller IP from common proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip')?.trim() ??
    'unknown'
  );
}

/** Bounds memory growth by dropping expired buckets once the map gets large. */
function sweep(now: number): void {
  if (buckets.size < 5_000) return;
  // forEach (not for...of) — Map iteration trips TS2802 on this tsconfig target.
  buckets.forEach((bucket, key) => {
    if (now > bucket.resetAt) buckets.delete(key);
  });
}

// ─── Scraping-burst detection (Architecture brief Bagian 8/9) ───────────────
// Repeatedly slamming a public endpoint *past* its rate limit is a strong signal
// of automated scraping rather than an impatient human. Count breaches per key
// and fire ONCE when the burst crosses the alert threshold (per window), so ops
// gets a single page, not a flood. (Kept in-memory: a per-instance alert dedupe
// is acceptable — worst case is one extra page per lambda, never a missed one.)

interface BreachBucket {
  breaches: number;
  resetAt: number;
  alerted: boolean;
}
const breachBuckets = new Map<string, BreachBucket>();

export interface ScrapingDetectOptions {
  windowMs: number;
  breachesBeforeAlert: number;
}

/** Record a rate-limit breach for `key`; returns true exactly once per window
 *  when the breach count crosses the alert threshold. */
export function recordRateLimitBreach(
  key: string,
  opts: ScrapingDetectOptions = { windowMs: 600_000, breachesBeforeAlert: 5 }
): boolean {
  const now = Date.now();
  const bucket = breachBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    breachBuckets.set(key, { breaches: 1, resetAt: now + opts.windowMs, alerted: false });
    return false;
  }
  bucket.breaches++;
  if (!bucket.alerted && bucket.breaches >= opts.breachesBeforeAlert) {
    bucket.alerted = true;
    return true; // cross the threshold → alert once
  }
  return false;
}

// ─── In-memory backend ──────────────────────────────────────────────────────

function rateLimitMemory(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.max - 1, retryAfter: 0 };
  }

  if (bucket.count >= opts.max) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count++;
  return { ok: true, remaining: opts.max - bucket.count, retryAfter: 0 };
}

// ─── Upstash Redis (REST) backend ───────────────────────────────────────────

interface UpstashCreds {
  url: string;
  token: string;
}

function upstashCreds(): UpstashCreds | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

/**
 * Fixed window via a single Redis pipeline:
 *   INCR key                       → current count this window
 *   PEXPIRE key windowMs NX        → set the TTL only on the first hit
 *   PTTL key                       → ms left in the window
 * Returns null on any transport/shape error so the caller can fall back.
 */
async function rateLimitUpstash(
  key: string,
  opts: RateLimitOptions,
  creds: UpstashCreds
): Promise<RateLimitResult | null> {
  try {
    const res = await fetch(`${creds.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['PEXPIRE', key, String(opts.windowMs), 'NX'],
        ['PTTL', key],
      ]),
      // Never let the limiter hang a request.
      signal: AbortSignal.timeout(1_000),
    });
    if (!res.ok) return null;

    const parts = (await res.json()) as Array<{ result?: number; error?: string }>;
    const count = parts[0]?.result;
    const pttl = parts[2]?.result;
    if (typeof count !== 'number') return null;

    if (count > opts.max) {
      const retryAfter =
        typeof pttl === 'number' && pttl > 0
          ? Math.ceil(pttl / 1000)
          : Math.ceil(opts.windowMs / 1000);
      return { ok: false, remaining: 0, retryAfter };
    }
    return { ok: true, remaining: Math.max(0, opts.max - count), retryAfter: 0 };
  } catch {
    return null; // network/timeout → caller falls back to in-memory
  }
}

/**
 * Apply a fixed-window limit to `key`. Uses Upstash Redis when configured;
 * production falls back to the durable PostgreSQL bucket, while local
 * development may use the in-memory counter.
 */
export async function rateLimit(
  key: string,
  opts: RateLimitOptions = { windowMs: 60_000, max: 60 }
): Promise<RateLimitResult> {
  const creds = upstashCreds();
  if (creds) {
    const result = await rateLimitUpstash(key, opts, creds);
    if (result) return result;
    // In production, never silently downgrade an abuse control to a
    // per-instance counter. PostgreSQL is already a required dependency.
    if (process.env.NODE_ENV === 'production') return durableRateLimit(key, opts);
  }
  if (process.env.NODE_ENV === 'production') return durableRateLimit(key, opts);
  return rateLimitMemory(key, opts);
}

/**
 * Authoritative limiter for authenticated mutations. PostgreSQL is already a
 * required dependency, so this remains global even when optional Redis is not
 * configured. Serializable retries close the lost-update window under load.
 */
export async function durableRateLimit(
  key: string,
  opts: RateLimitOptions = { windowMs: 60_000, max: 20 }
): Promise<RateLimitResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const now = new Date();
          const existing = await tx.rateLimitBucket.findUnique({ where: { key } });

          if (!existing || existing.resetAt <= now) {
            const resetAt = new Date(now.getTime() + opts.windowMs);
            await tx.rateLimitBucket.upsert({
              where: { key },
              create: { key, count: 1, resetAt },
              update: { count: 1, resetAt },
            });
            return { ok: true, remaining: Math.max(0, opts.max - 1), retryAfter: 0 };
          }

          const retryAfter = Math.max(
            1,
            Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000)
          );
          if (existing.count >= opts.max) {
            return { ok: false, remaining: 0, retryAfter };
          }

          const updated = await tx.rateLimitBucket.update({
            where: { key },
            data: { count: { increment: 1 } },
          });
          return {
            ok: true,
            remaining: Math.max(0, opts.max - updated.count),
            retryAfter: 0,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 2
      ) {
        continue;
      }
      throw new ServiceUnavailableError('Proteksi keamanan sementara tidak tersedia. Coba lagi.');
    }
  }

  throw new ServiceUnavailableError('Proteksi keamanan sementara tidak tersedia. Coba lagi.');
}

export async function enforceDurableRateLimit(key: string, opts?: RateLimitOptions): Promise<void> {
  const result = await durableRateLimit(key, opts);
  if (!result.ok) {
    throw new RateLimitedError(
      `Terlalu banyak permintaan. Coba lagi dalam ${result.retryAfter} detik.`
    );
  }
}
