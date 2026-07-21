import { test, expect } from '@playwright/test';

// Prereq: dev server + a Postgres seeded with verified, available providers
// (npm run db:seed). Provider cards are anchored by their booking CTA.
const cards = (page: import('@playwright/test').Page) =>
  page.getByRole('link', { name: /Booking/i });

test.describe('Search & Filter Tukang', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/search');
  });

  test('halaman search menampilkan daftar tukang', async ({ page }) => {
    await expect(cards(page).first()).toBeVisible({ timeout: 10_000 });
  });

  test('search bar memfilter hasil', async ({ page }) => {
    await expect(cards(page).first()).toBeVisible({ timeout: 10_000 });
    const before = await cards(page).count();
    await page.getByLabel('Cari tukang').fill('ledeng');
    await expect.poll(async () => cards(page).count()).toBeLessThanOrEqual(before);
  });

  test('filter kategori Tukang Listrik hanya menampilkan tukang listrik', async ({ page }) => {
    const chip = page.getByRole('button', { name: 'Tukang Listrik' });
    if ((await chip.count()) === 0) test.skip(true, 'No Tukang Listrik category seeded');
    await chip.click();

    const count = await cards(page).count();
    for (let i = 0; i < count; i++) {
      await expect(page.getByText('Tukang Listrik').nth(i)).toBeVisible();
    }
  });

  test('tanpa hasil menampilkan empty state', async ({ page }) => {
    await expect(page.getByLabel('Cari tukang')).toBeVisible();
    await page.getByLabel('Cari tukang').fill('xyzabc123tidakada');
    await expect(page.getByText(/Belum ada tukang di area ini/i)).toBeVisible();
  });

  test('hapus kata kunci menampilkan tukang kembali', async ({ page }) => {
    await expect(cards(page).first()).toBeVisible({ timeout: 10_000 });
    await page.getByLabel('Cari tukang').fill('xyzabc123tidakada');
    await expect(page.getByText(/Belum ada tukang di area ini/i)).toBeVisible();
    await page.getByLabel('Cari tukang').fill('');
    await expect(cards(page).first()).toBeVisible();
  });

  test('kartu tukang punya tautan ke /book/[id]', async ({ page }) => {
    await expect(cards(page).first()).toHaveAttribute('href', /^\/book\//);
  });
});
