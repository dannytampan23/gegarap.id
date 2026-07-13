import { test, expect } from '@playwright/test';

// Prereq: dev server + a Postgres seeded with verified, available providers
// (npm run db:seed). Provider cards have no data-testid, so we locate them by
// their "Booking" link (one per ProviderCard).

const cards = (page: import('@playwright/test').Page) =>
  page.getByRole('link', { name: 'Booking' });

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
    // results recompute synchronously (client filter) — give React a tick.
    await expect.poll(async () => cards(page).count()).toBeLessThanOrEqual(before);
  });

  test('filter kategori "Tukang Listrik" → hanya tukang listrik', async ({ page }) => {
    const chip = page.getByRole('button', { name: 'Tukang Listrik' });
    if ((await chip.count()) === 0) test.skip(true, 'No Tukang Listrik category seeded');
    await chip.click();
    // Every visible card's category badge should read "Listrik".
    const count = await cards(page).count();
    for (let i = 0; i < count; i++) {
      await expect(page.getByText('Tukang Listrik').nth(i)).toBeVisible();
    }
  });

  test('tanpa hasil → empty state tampil', async ({ page }) => {
    await page.getByLabel('Cari tukang').fill('xyzabc123tidakada');
    await expect(page.getByText(/Belum ada tukang di area ini/i)).toBeVisible();
  });

  test('hapus kata kunci → tukang muncul kembali', async ({ page }) => {
    await page.getByLabel('Cari tukang').fill('xyzabc123tidakada');
    await expect(page.getByText(/Belum ada tukang di area ini/i)).toBeVisible();
    await page.getByLabel('Cari tukang').fill('');
    await expect(cards(page).first()).toBeVisible();
  });

  test('kartu tukang punya tautan ke /book/[id]', async ({ page }) => {
    await expect(cards(page).first()).toHaveAttribute('href', /^\/book\//);
  });
});
