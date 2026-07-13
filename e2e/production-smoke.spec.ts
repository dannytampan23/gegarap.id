import { expect, test } from '@playwright/test';

test.describe('production read-only smoke', () => {
  test('public pages and health are available without browser errors', async ({
    page,
    request,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    for (const path of ['/', '/search', '/login', '/register']) {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), path).toBeLessThan(400);
      await expect(page.locator('body'), path).toBeVisible();
    }

    const health = await request.get('/api/health');
    expect(health.status()).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, checks: { database: 'ok' } });
    const localFirebaseEmulator = process.env.PLAYWRIGHT_BASE_URL?.includes('127.0.0.1');
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
    expect(response.status()).toBe(200);
    const payload = (await response.json()) as { data?: Array<{ id: string }> };
    const providerId = payload.data?.[0]?.id;
    expect(providerId).toBeTruthy();

    await page.goto(`/book/${providerId}`);
    await expect(page).toHaveURL(new RegExp(`/login\\?redirect=.*book`));
  });
});
