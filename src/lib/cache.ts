/**
 * Tiny Upstash Redis (REST) cache. Same transport pattern as `lib/rate-limit.ts`
 * — raw REST commands, no extra dependency. No-op (returns null / does nothing)
 * when Upstash isn't configured, so dev works without Redis. Never throws.
 */

const URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function configured(): boolean {
  return Boolean(URL && TOKEN);
}

async function command(cmd: (string | number)[]): Promise<unknown> {
  if (!configured()) return null;
  try {
    const res = await fetch(URL!, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
      signal: AbortSignal.timeout(1_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: unknown };
    return json.result ?? null;
  } catch {
    return null; // network/timeout → treat as a miss
  }
}

/** Read and JSON-parse a cached value, or null on miss/error. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const result = await command(['GET', key]);
  if (typeof result !== 'string') return null;
  try {
    return JSON.parse(result) as T;
  } catch {
    return null;
  }
}

/** Cache a JSON value with a TTL (seconds). Best-effort. */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await command(['SET', key, JSON.stringify(value), 'EX', ttlSeconds]);
}
