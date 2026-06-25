import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ok, fail, handle } from '@/lib/api';
import { requireAdmin } from '@/lib/admin-guard';
import { recordAudit, AuditAction } from '@/lib/audit';
import { enqueueWhatsApp } from '@/lib/outbox';

const rejectSchema = z.object({
  reason: z.string().trim().min(5, 'Alasan minimal 5 karakter').max(500),
});

/** POST /api/admin/providers/:id/reject — fail KYC with a stored reason. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return fail('Akses ditolak.', 403);

    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);
    const { reason } = rejectSchema.parse(body);

    const profile = await prisma.providerProfile.findUnique({
      where: { id: params.id },
      include: { user: { select: { name: true, phone: true } } },
    });
    if (!profile) return fail('Profil tukang tidak ditemukan.', 404);

    await prisma.providerProfile.update({
      where: { id: profile.id },
      data: {
        isVerified: false,
        kycStatus: 'REJECTED',
        kycReason: reason,
        kycReviewedAt: new Date(),
        kycReviewedById: admin.id,
      },
    });

    await recordAudit({
      actorId: admin.id,
      action: AuditAction.KycReject,
      targetType: 'ProviderProfile',
      targetId: profile.id,
      metadata: { name: profile.user.name, reason },
    });

    // Tell the provider why, so they can fix and resubmit (best-effort, via the
    // outbox). No dedupeKey — a provider can be rejected more than once across
    // resubmissions, and each rejection is a distinct notification.
    if (profile.user.phone) {
      await enqueueWhatsApp(
        profile.user.phone,
        `❌ *Verifikasi KYC Belum Disetujui*\n\n` +
          `Halo ${profile.user.name}, pendaftaran tukang Anda belum bisa kami setujui.\n` +
          `Alasan: ${reason}\n\n` +
          `Silakan perbaiki dan kirim ulang melalui halaman pendaftaran.`
      );
    }

    return ok({ id: profile.id, kycStatus: 'REJECTED' });
  })();
}
