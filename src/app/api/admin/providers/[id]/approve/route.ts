import prisma from '@/lib/prisma';
import { ok, fail, handle } from '@/lib/api';
import { requireAdmin } from '@/lib/admin-guard';
import { recordAudit, AuditAction } from '@/lib/audit';
import { sendWAMessage } from '@/lib/whatsapp';

/** POST /api/admin/providers/:id/approve — pass KYC; provider goes live. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return fail('Akses ditolak.', 403);

    const profile = await prisma.providerProfile.findUnique({
      where: { id: params.id },
      include: { user: { select: { name: true, phone: true } } },
    });
    if (!profile) return fail('Profil tukang tidak ditemukan.', 404);

    await prisma.providerProfile.update({
      where: { id: profile.id },
      data: {
        isVerified: true,
        kycStatus: 'APPROVED',
        kycReason: null,
        kycReviewedAt: new Date(),
        kycReviewedById: admin.id,
      },
    });

    await recordAudit({
      actorId: admin.id,
      action: AuditAction.KycApprove,
      targetType: 'ProviderProfile',
      targetId: profile.id,
      metadata: { name: profile.user.name, category: profile.category },
    });

    // Tell the provider they're live (best-effort).
    if (profile.user.phone) {
      await sendWAMessage(
        profile.user.phone,
        `✅ *Verifikasi KYC Disetujui!*\n\n` +
          `Selamat ${profile.user.name}, profil tukang Anda di gegarap.id sudah aktif dan ` +
          `tampil di marketplace. Anda kini bisa menerima pekerjaan. 🔧\n\n` +
          `Cek dashboard: ${process.env.NEXTAUTH_URL ?? ''}/provider/dashboard`
      );
    }

    return ok({ id: profile.id, kycStatus: 'APPROVED', isVerified: true });
  })();
}
