import { test, expect } from '@playwright/test';

// Real hero CTAs: "Cari Tukang" → /search, "Daftar sebagai Tukang" → /onboarding.
// Navbar logged-out CTA is "Masuk" → /login.

test.describe('Homepage', () => {
  test('tampil headline + CTA utama', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /Cari Tukang/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Daftar sebagai Tukang/i })).toBeVisible();
  });

  test('hero CTA mengarah ke halaman yang benar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Daftar sebagai Tukang/i })).toHaveAttribute(
      'href',
      '/onboarding'
    );
  });

  test('blok statistik tampil', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Tukang terverifikasi')).toBeVisible();
    await expect(page.getByText('Pekerjaan selesai')).toBeVisible();
  });

  test('navbar belum login → tautan Masuk ke /login', async ({ page }) => {
    await page.goto('/');
    const masuk = page.getByRole('link', { name: 'Masuk' }).first();
    await expect(masuk).toHaveAttribute('href', '/login');
  });
});
