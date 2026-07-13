import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAuthorizedCron } from '@/lib/cron-auth';

describe('cron authorization', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts the exact Vercel cron secret', async () => {
    vi.stubEnv('CRON_SECRET', 'a'.repeat(32));
    vi.stubEnv('NODE_ENV', 'production');
    const request = new Request('https://gegarap.id/api/cron/reconcile', {
      headers: { Authorization: `Bearer ${'a'.repeat(32)}` },
    });

    await expect(isAuthorizedCron(request)).resolves.toBe(true);
  });

  it('fails closed in production without credentials', async () => {
    vi.stubEnv('CRON_SECRET', '');
    vi.stubEnv('NODE_ENV', 'production');

    await expect(
      isAuthorizedCron(new Request('https://gegarap.id/api/cron/reconcile'))
    ).resolves.toBe(false);
  });

  it('allows credential-free local development only', async () => {
    vi.stubEnv('CRON_SECRET', '');
    vi.stubEnv('NODE_ENV', 'development');

    await expect(
      isAuthorizedCron(new Request('http://localhost/api/cron/reconcile'))
    ).resolves.toBe(true);
  });
});
