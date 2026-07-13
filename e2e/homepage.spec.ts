import { test, expect } from '@playwright/test';

// Real hero CTAs: "Cari Tukang" → /search, "Jadi Mitra" → /onboarding.
// Navbar logged-out CTA is "Masuk" → /login.

test.describe('Homepage', () => {
  test('tampil headline + CTA utama', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /Cari Tukang/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Jadi Mitra/i }).first()).toBeVisible();
  });

  test('hero CTA mengarah ke halaman yang benar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Jadi Mitra/i }).first()).toHaveAttribute(
      'href',
      '/onboarding'
    );
  });

  test('blok statistik tampil', async ({ page }) => {
    await page.goto('/');
    const stats = page.getByLabel('Statistik gegarap.id');
    await expect(stats.getByText('Tukang Terverifikasi', { exact: true })).toBeVisible();
    await expect(stats.getByText('Pekerjaan Selesai', { exact: true })).toBeVisible();
  });

  test('navbar belum login → tautan Masuk ke /login', async ({ page }) => {
    await page.goto('/');
    const masuk = page.getByRole('link', { name: 'Masuk' }).first();
    if ((await masuk.count()) === 0) {
      await page.getByRole('button', { name: 'Buka menu' }).click();
    }
    await expect(masuk).toHaveAttribute('href', '/login');
  });
});
