import { test, expect } from '@playwright/test';

// Real hero CTAs: "Cari Tukang" -> /search, "Jadi Mitra" -> /onboarding.
// Navbar logged-out CTA is "Masuk" -> /login.

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

  test('blok statistik tidak pernah menampilkan angka nol palsu', async ({ page, request }) => {
    await page.goto('/');
    const response = await request.get('/api/stats');

    if (response.ok()) {
      const stats = (await response.json()) as {
        workerCount?: number;
        avgRating?: number;
        jobCount?: number;
      };
      const shouldRender = Boolean(stats.workerCount && stats.avgRating && stats.jobCount);
      if (shouldRender) {
        const row = page.getByLabel('Statistik gegarap.id');
        await expect(row.getByText('Tukang Terverifikasi', { exact: true })).toBeVisible();
        await expect(row.getByText('Pekerjaan Selesai', { exact: true })).toBeVisible();
      } else {
        await expect(page.getByLabel('Statistik gegarap.id')).toHaveCount(0);
      }
    } else {
      await expect(page.getByLabel('Statistik gegarap.id')).toHaveCount(0);
    }
  });

  test('navbar belum login punya tautan Masuk ke /login', async ({ page }) => {
    await page.goto('/');
    const masuk = page.getByRole('link', { name: 'Masuk' }).first();
    if ((await masuk.count()) === 0) {
      await page.getByRole('button', { name: 'Buka menu' }).click();
    }
    await expect(masuk).toHaveAttribute('href', '/login');
  });
});
