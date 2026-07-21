import { expect, test } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? '';
const isExternalSmoke = /^https?:\/\//.test(baseUrl);

test.describe('production read-only smoke', () => {
  test('public pages and health are available without browser errors', async ({
    page,
    request,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    const paths = isExternalSmoke ? ['/', '/search', '/login', '/register'] : ['/', '/login', '/register'];
    for (const path of paths) {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), path).toBeLessThan(400);
      await expect(page.locator('body'), path).toBeVisible();
    }

    const health = await request.get('/api/health');
    if (isExternalSmoke) {
      expect(health.status()).toBe(200);
      expect(await health.json()).toMatchObject({ ok: true, checks: { database: 'ok' } });
    } else {
      expect([200, 503]).toContain(health.status());
    }

    const localFirebaseEmulator = !isExternalSmoke || baseUrl.includes('127.0.0.1');
    const actionableErrors = consoleErrors.filter(
      (message) =>
        !(
          localFirebaseEmulator &&
          message.includes('127.0.0.1:9099') &&
          message.includes('report-only Content Security Policy')
        )
    );
    expect(actionableErrors).toEqual([]);
  });

  test('a live provider booking route reaches the authentication gate', async ({
    page,
    request,
  }) => {
    const response = await request.get('/api/providers');
    if (!response.ok()) test.skip(true, 'Provider API unavailable in this environment');

    const payload = (await response.json()) as { data?: Array<{ id: string }> };
    const providerId = payload.data?.[0]?.id ?? '00000000-0000-4000-8000-000000000000';

    const bookingResponse = await page.goto(`/book/${providerId}`);
    expect(bookingResponse?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(new RegExp(`/login\\?redirect=.*book`));
  });
});
