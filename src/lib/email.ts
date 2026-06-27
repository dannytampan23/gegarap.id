/**
 * Transactional email (server-only). Currently the DP receipt: a branded summary
 * with the PDF nota attached, sent on payment success.
 *
 * Mirrors the Midtrans/WhatsApp pattern — without `EMAIL_API_KEY` it is a logged
 * no-op so dev/build stays green, and it NEVER throws (callers fire-and-forget it
 * off the webhook's critical path).
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { Resend } from 'resend';
import { ReceiptDocument } from '@/components/receipt/ReceiptDocument';
import { getReceiptData, type ReceiptData } from './receipt';
import { logEvent } from './logger';

const apiKey = process.env.EMAIL_API_KEY;
const fromAddress = process.env.EMAIL_FROM ?? 'gegarap.id <noreply@gegarap.id>';

/** Whether real Resend credentials are present. */
export const isEmailConfigured = Boolean(apiKey);

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

function receiptHtml(data: ReceiptData, receiptUrl: string): string {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#64748b">${k}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a">${v}</td></tr>`;
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
    <div style="font-size:20px;font-weight:800;color:#2D9B4E">gegarap.id</div>
    <h1 style="font-size:20px;margin:20px 0 4px">✅ Pembayaran DP Berhasil</h1>
    <p style="color:#64748b;margin:0 0 20px">Terima kasih! DP untuk booking <strong>#${data.shortId}</strong> sudah kami terima dan dana Anda aman di sistem.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e2e8f0;border-radius:12px;padding:16px">
      ${row('Tukang', data.providerName)}
      ${row('Layanan', data.category)}
      ${row('Total Biaya', rp(data.totalFee))}
      ${row(`DP Dibayar (${data.dpPercent}%)`, rp(data.dpAmount))}
      ${row('Sisa Pelunasan', rp(data.remaining))}
    </table>
    <p style="color:#64748b;font-size:13px;margin:14px 0 24px">Sisa pelunasan ditagih setelah pekerjaan dikonfirmasi selesai. Nota lengkap (PDF) terlampir pada email ini.</p>
    <a href="${receiptUrl}" style="display:inline-block;background:#2D9B4E;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px">Lihat Detail Booking</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:28px">Email otomatis dari gegarap.id. Mohon tidak membalas email ini.</p>
  </div>`;
}

/**
 * Send the DP receipt email (with PDF attachment) for a booking. Best-effort:
 * loads its own data, no-ops without credentials, and swallows all errors.
 */
export async function sendReceiptEmail(jobId: string): Promise<void> {
  try {
    const data = await getReceiptData(jobId);
    if (!data) {
      logEvent('email.skipped', { jobId, reason: 'receipt data not found' }, 'warn');
      return;
    }
    if (!isEmailConfigured) {
      logEvent('email.skipped', { jobId, shortId: data.shortId, reason: 'EMAIL_API_KEY missing' });
      return;
    }

    const pdf = await renderToBuffer(ReceiptDocument({ data }));
    const receiptUrl = `${process.env.APP_URL ?? ''}/booking/${data.jobId}/receipt`;

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: data.customerEmail,
      subject: `✅ Pembayaran DP Berhasil - Booking #${data.shortId}`,
      html: receiptHtml(data, receiptUrl),
      attachments: [{ filename: `Nota-DP-${data.shortId}-gegarap.pdf`, content: pdf }],
    });

    if (error) {
      logEvent('email.failed', { jobId, shortId: data.shortId, error: String(error) }, 'warn');
      return;
    }
    logEvent('email.sent', { jobId, shortId: data.shortId, to: data.customerEmail });
  } catch (err) {
    logEvent('email.failed', { jobId, error: String(err) }, 'warn');
  }
}
