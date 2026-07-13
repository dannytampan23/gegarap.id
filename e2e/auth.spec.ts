import { test, expect } from '@playwright/test';

// Prereq: `npm run dev` running (Next + Firebase emulators). The redirect tests
// only need the dev server — they assert the middleware bounce for logged-out
// visitors (no session cookie present).

test.describe('Auth — Email/WhatsApp + Password', () => {
  test('halaman login tampil dengan benar', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible();
    await expect(page.getByLabel('Email atau No. WhatsApp')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Lanjutkan dengan Google/i })).toBeVisible();
  });

  test('submit kosong → pesan error (validasi klien)', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /^Masuk$/ }).click();
    await expect(page.getByText(/wajib diisi/i)).toBeVisible();
  });

  test('halaman daftar punya field lengkap (tanpa OTP)', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel('Nama lengkap')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Nomor WhatsApp')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirm')).toBeVisible();
  });

  test('/dashboard redirect ke /login jika belum login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/book/[id] redirect ke /login jika belum login', async ({ page }) => {
    await page.goto('/book/some-provider-id');
    await expect(page).toHaveURL(/\/login/);
  });
});
