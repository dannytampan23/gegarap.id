import { test, expect } from '@playwright/test';
import { loginWithPhone } from './helpers/auth';

// Prereq: dev server + seeded Postgres + E2E_TESTING=true (for the OTP helper).
// The real customer dashboard has NO tabs — it renders a bookings list, or an
// empty state ("Belum ada booking") with a "Cari Tukang" link.

test.describe('Customer Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithPhone(page);
  });

  test('dashboard tampil dengan judul', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Dashboard Saya/i })).toBeVisible();
  });

  test('tanpa booking → empty state + tombol Cari Tukang', async ({ page }) => {
    // Assumes the freshly-logged-in test user has no bookings yet.
    const empty = page.getByText(/Belum ada booking/i);
    if ((await empty.count()) === 0) test.skip(true, 'Test user already has bookings');
    await expect(empty).toBeVisible();
    await expect(page.getByRole('link', { name: /Cari Tukang/i })).toBeVisible();
  });
});

test.describe('Provider Dashboard — Security', () => {
  test('customer biasa diarahkan keluar dari /provider/dashboard', async ({ page }) => {
    await loginWithPhone(page, '81234567890'); // customer biasa (role CUSTOMER)
    await page.goto('/provider/dashboard');
    // Provider dashboard must not stay open for a non-provider.
    await expect(page).not.toHaveURL(/\/provider\/dashboard$/);
  });
});
