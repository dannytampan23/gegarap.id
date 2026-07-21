import { Page, expect, test } from '@playwright/test';

/**
 * Authenticate for e2e through the test-only session endpoint. The route exists
 * only when the Playwright web server sets E2E_TESTING=true, so dashboard tests
 * do not depend on Firebase emulator startup or external auth state.
 */
export async function loginWithPhone(page: Page, local?: string) {
  const response = await page.request.post('/api/e2e/session', {
    data: { phone: local ?? undefined },
  });
  if (!response.ok()) {
    test.skip(true, `E2E session unavailable (${response.status()}); check local DATABASE_URL/seed`);
  }

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /Dashboard Saya/i })).toBeVisible();
}
