import prisma from '@/lib/prisma';
import { ok, fail, handle } from '@/lib/api';
import { requireAdmin } from '@/lib/admin-guard';
import { recordAudit, AuditAction } from '@/lib/audit';

/** POST /api/admin/providers/:id/approve — pass KYC; provider goes live. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const admin = await requireAdmin();
    if (!admin) return fail('Akses ditolak.', 403);

    const profile = await prisma.providerProfile.findUnique({
      where: { id },
      select: {
        id: true,
        category: true,
        user: { select: { name: true, phone: true } },
      },
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
        identityStatus: 'MANUALLY_VERIFIED',
        identityVerifiedAt: new Date(),
        identityRejectedReason: null,
        verifiedByAdminId: admin.id,
      },
    });

    await recordAudit({
      actorId: admin.id,
      action: AuditAction.KycApprove,
      targetType: 'ProviderProfile',
      targetId: profile.id,
      metadata: { name: profile.user.name, category: profile.category },
    });

    return ok({
      id: profile.id,
      kycStatus: 'APPROVED',
      identityStatus: 'MANUALLY_VERIFIED',
      isVerified: true,
    });
  })();
}
