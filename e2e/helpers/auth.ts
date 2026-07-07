import { Page, expect } from '@playwright/test';

/**
 * Authenticate for e2e by registering a fresh account through the real UI.
 *
 * OTP was removed, so auth is now email/WhatsApp + password. Each call creates a
 * unique CUSTOMER (random email + WA number) and lands authenticated on the
 * dashboard — so tests stay independent and the new user starts with no bookings.
 *
 * The legacy `local` argument is accepted for backward compatibility but ignored
 * (every call now provisions its own throwaway customer).
 */
export async function loginWithPhone(page: Page, local?: string) {
  void local;
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `e2e-${unique}@test.gegarap.id`;
  // National part: 81 + 8 digits → +62 81xxxxxxxx (passes the ID phone regex).
  const waLocal = `81${unique.slice(-8).padStart(8, '0')}`;
  const password = 'Password123';

  await page.goto('/register');

  await page.getByLabel('Nama lengkap').fill('E2E Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Nomor WhatsApp').fill(waLocal);
  await page.getByLabel('Kata sandi', { exact: true }).fill(password);
  await page.getByLabel('Konfirmasi kata sandi').fill(password);

  await page.getByRole('button', { name: /^Daftar$/ }).click();

  // registerUser → auto signIn('credentials') → router.push('/dashboard').
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Dashboard Saya/i })).toBeVisible();
}
