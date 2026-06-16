import { test, expect } from '@playwright/test';

// Prereq: `npm run dev` running + Postgres reachable (the OTP-stage test writes
// an OtpToken). The middleware redirect tests need only NEXTAUTH_SECRET.

test.describe('Auth — WhatsApp OTP', () => {
  test('halaman login tampil dengan benar', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Masuk atau Daftar')).toBeVisible();
    await expect(page.getByLabel('Nomor WhatsApp')).toBeVisible();
    await expect(page.getByRole('button', { name: /Kirim Kode OTP/i })).toBeVisible();
    // No email/password — it's passwordless.
    await expect(page.getByPlaceholder(/email/i)).toHaveCount(0);
  });

  test('nomor terlalu pendek → pesan error (validasi klien)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Nomor WhatsApp').fill('123');
    await page.getByRole('button', { name: /Kirim Kode OTP/i }).click();
    await expect(page.getByText(/Masukkan nomor WhatsApp yang valid/i)).toBeVisible();
  });

  test('nomor valid → muncul input OTP', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Nomor WhatsApp').fill('81234567890');
    await page.getByRole('button', { name: /Kirim Kode OTP/i }).click();
    await expect(page.getByText('Cek WhatsApp Anda')).toBeVisible({ timeout: 10_000 });
    // 6 OTP boxes appear.
    await expect(page.getByRole('textbox')).toHaveCount(6);
  });

  test('tombol "Ganti Nomor" → kembali ke input nomor', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Nomor WhatsApp').fill('81234567890');
    await page.getByRole('button', { name: /Kirim Kode OTP/i }).click();
    await expect(page.getByText('Cek WhatsApp Anda')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Ganti Nomor/i }).click();
    await expect(page.getByLabel('Nomor WhatsApp')).toBeVisible();
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
