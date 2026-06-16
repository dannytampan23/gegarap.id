import { Page, expect } from '@playwright/test';

/**
 * Log in through the real WhatsApp-OTP flow. Reads the generated code from the
 * test-only endpoint /api/test/get-otp (enabled by E2E_TESTING=true), so no real
 * WhatsApp message is needed.
 *
 * `local` is the WA number WITHOUT the leading 0 / +62 (e.g. "81234567890").
 */
export async function loginWithPhone(page: Page, local = '81234567890') {
  await page.goto('/login');

  await page.getByLabel('Nomor WhatsApp').fill(local);
  await page.getByRole('button', { name: /Kirim Kode OTP/i }).click();

  // OTP stage shows up once /api/auth/send-otp succeeds.
  await expect(page.getByText('Cek WhatsApp Anda')).toBeVisible({ timeout: 10_000 });

  // normalizePhone(local) → "62" + local
  const phone = `62${local}`;
  const res = await page.request.get(`/api/test/get-otp?phone=${phone}`);
  const { otp } = (await res.json()) as { otp: string | null };
  if (!otp) throw new Error(`No OTP found for ${phone} — is E2E_TESTING=true and the DB seeded?`);

  // The 6 OTP boxes are <input> (role "textbox"), aria-label "Digit OTP ke-N".
  const boxes = page.getByRole('textbox');
  for (let i = 0; i < 6; i++) {
    await boxes.nth(i).fill(otp[i]);
  }

  // submitOtp → signIn → router.push(redirect || '/dashboard').
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
}
