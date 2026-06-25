/**
 * Centralized payment-status notifications (PROMPT MASTER Bagian 9).
 *
 * Every payment status change must reach BOTH parties in plain Indonesian — never
 * a raw status code. This module is the single source of truth for that copy and
 * for dispatch; transition call sites just call `notifyPaymentStatus(...)`
 * instead of hand-rolling messages, so the wording lives in one place.
 *
 * It is best-effort: it loads its own data, never throws, and delivery is
 * deferred to the outbox (Bagian 10) so a slow/failing gateway never blocks or
 * breaks the transaction that triggered it. The cron dispatcher does the actual
 * WhatsApp send + retries.
 */

import prisma from './prisma';
import { enqueueWhatsApp } from './outbox';
import { logEvent } from './logger';
import type { PaymentStatus } from './payment-state';

/** Context the message builders can use. */
interface NotifyContext {
  ref: string; // short booking id, e.g. "A1B2C3"
  amount: number; // DP captured
  providerAmount: number;
  platformFee: number;
  customerName: string;
  providerName: string;
  scheduledDate: Date | null;
  extra: NotifyExtra;
}

/** Optional details a caller can pass to enrich the copy. */
export interface NotifyExtra {
  /** Payout outcome for RELEASED, so we can say "dicairkan" vs "menunggu KYC". */
  settleStatus?: 'SCHEDULED' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  settleReason?: string;
  /** Refund economics for REFUNDED. */
  refundAmount?: number;
  providerCompensation?: number;
  /** Free-form reason shown for DISPUTED / REFUND_REJECTED. */
  reason?: string;
}

type Builder = (c: NotifyContext) => string;
interface RoleCopy {
  customer?: Builder;
  provider?: Builder;
}

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

/**
 * Per-status copy for each role. A missing role builder means that party isn't
 * notified for that status (e.g. provider doesn't see PENDING/FAILED).
 */
const COPY: Partial<Record<PaymentStatus, RoleCopy>> = {
  PAID: {
    customer: (c) =>
      `✅ *Pembayaran Diterima!*\n\nBooking #${c.ref} dikonfirmasi.\n` +
      `Tukang: ${c.providerName}\n` +
      (c.scheduledDate ? `Jadwal: ${c.scheduledDate.toLocaleDateString('id-ID')}\n` : '') +
      `\nDana Anda aman di sistem. Tukang akan segera menghubungi Anda. 🔧`,
    provider: (c) =>
      `📋 *Job Baru — Pembayaran Customer Sudah Aman*\n\nBooking #${c.ref} dari ${c.customerName}.\n` +
      `Pembayaran sudah masuk dan ditahan sistem — aman untuk Anda kerjakan.`,
  },
  HELD: {
    customer: (c) =>
      `🔧 *Pekerjaan Dimulai*\n\nTukang mulai mengerjakan booking #${c.ref}.\n` +
      `Dana Anda *ditahan aman* oleh sistem dan baru cair ke tukang setelah pekerjaan selesai.`,
    provider: (c) =>
      `🔧 *Sedang Dikerjakan*\n\nBooking #${c.ref} berjalan. Dana akan cair ke rekening Anda setelah pekerjaan dikonfirmasi selesai.`,
  },
  RELEASED: {
    customer: (c) => `🎉 *Pekerjaan Selesai — Terima kasih!*\n\nBooking #${c.ref} telah selesai. Semoga puas dengan layanan tukang kami!`,
    provider: (c) =>
      c.extra.settleStatus === 'SUCCESS'
        ? `💰 *Dana Telah Dicairkan ke Rekening Anda*\n\nBooking #${c.ref} selesai.\n` +
          `Dicairkan: *${rp(c.providerAmount)}* (platform fee ${rp(c.platformFee)} sudah dipotong).`
        : `✅ *Pekerjaan Selesai*\n\nBooking #${c.ref} selesai. Dana ${rp(c.providerAmount)} sudah aman.\n` +
          (c.extra.settleReason === 'kyc_pending'
            ? 'Selesaikan verifikasi rekening/KYC Anda untuk mencairkannya.'
            : 'Pencairan sedang diproses dan akan segera masuk ke rekening Anda.'),
  },
  REFUNDED: {
    customer: (c) =>
      `↩️ *Dana Telah Dikembalikan*\n\nRefund untuk booking #${c.ref} sebesar ` +
      `${rp(c.extra.refundAmount ?? c.amount)} akan kembali ke metode pembayaran Anda dalam beberapa hari kerja.`,
    provider: (c) =>
      `ℹ️ *Pembatalan Disetujui*\n\nBooking #${c.ref} dibatalkan dan dana dikembalikan ke customer.\n` +
      (c.extra.providerCompensation && c.extra.providerCompensation > 0
        ? `Kompensasi untuk Anda: ${rp(c.extra.providerCompensation)}.`
        : '') +
      (c.extra.reason ? `\nAlasan: ${c.extra.reason}` : ''),
  },
  REFUND_REJECTED: {
    customer: (c) =>
      `ℹ️ *Pengajuan Refund Ditolak*\n\nPengajuan pembatalan untuk booking #${c.ref} tidak disetujui.` +
      (c.extra.reason ? `\nAlasan: ${c.extra.reason}` : ''),
    provider: (c) => `✅ *Pekerjaan Dilanjutkan*\n\nKomplain pada booking #${c.ref} tidak terbukti — pekerjaan dilanjutkan.`,
  },
  DISPUTED: {
    customer: (c) =>
      `🔎 *Sedang Ditinjau Tim Kami*\n\nPengajuan pada booking #${c.ref} sedang kami tinjau (estimasi 48 jam).\n` +
      `Dana Anda ditahan aman selama peninjauan.`,
    provider: (c) =>
      `⚠️ *Ada Komplain — Tim Kami Akan Hubungi Anda*\n\nBooking #${c.ref} sedang ditinjau. Dana ditahan sementara hingga peninjauan selesai.` +
      (c.extra.reason ? `\nCatatan: ${c.extra.reason}` : ''),
  },
  EXPIRED: {
    customer: (c) =>
      `⌛ *Pembayaran Kedaluwarsa*\n\nBatas waktu pembayaran booking #${c.ref} telah lewat dan booking dibatalkan otomatis.\n` +
      `Silakan booking ulang bila masih membutuhkan layanan.`,
  },
  FAILED: {
    customer: (c) =>
      `❌ *Pembayaran Gagal*\n\nPembayaran untuk booking #${c.ref} tidak berhasil diproses. Silakan coba lagi.`,
  },
};

/**
 * Notify both parties of a payment status change. Loads the payment (+ job,
 * customer, provider) itself so callers only pass the id and the new status.
 * Never throws.
 */
export async function notifyPaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  extra: NotifyExtra = {}
): Promise<void> {
  const copy = COPY[status];
  if (!copy) return; // status not surfaced to anyone

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        job: { include: { customer: true, provider: { include: { user: true } } } },
      },
    });
    if (!payment?.job) return;

    const job = payment.job;
    const ctx: NotifyContext = {
      ref: job.id.slice(-6).toUpperCase(),
      amount: payment.amount,
      providerAmount: payment.providerAmount,
      platformFee: payment.platformFee,
      customerName: job.customer.name ?? job.customer.phone ?? 'Customer',
      providerName: job.provider.user.name ?? 'Tukang',
      scheduledDate: job.scheduledDate ?? null,
      extra,
    };

    // Enqueue (don't send) — the outbox dispatcher delivers + retries. The
    // dedupeKey makes a re-fired transition (e.g. a webhook retry) idempotent.
    const tasks: Promise<unknown>[] = [];
    if (copy.customer && job.customer.phone) {
      tasks.push(
        enqueueWhatsApp(job.customer.phone, copy.customer(ctx), `pay:${paymentId}:${status}:customer`)
      );
    }
    if (copy.provider && job.provider.user.phone) {
      tasks.push(
        enqueueWhatsApp(job.provider.user.phone, copy.provider(ctx), `pay:${paymentId}:${status}:provider`)
      );
    }
    if (tasks.length === 0) return;

    await Promise.all(tasks);
    logEvent('notification.enqueued', { paymentId, status, queued: tasks.length });
  } catch (err) {
    logEvent('notification.failed', { paymentId, status, error: String(err) }, 'warn');
  }
}
