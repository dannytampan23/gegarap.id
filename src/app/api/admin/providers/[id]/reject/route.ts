import { z } from 'zod';
import prisma from '@/lib/prisma';
import { ok, fail, handle } from '@/lib/api';
import { requireAdmin } from '@/lib/admin-guard';
import { recordAudit, AuditAction } from '@/lib/audit';

const rejectSchema = z.object({
  reason: z.string().trim().min(5, 'Alasan minimal 5 karakter').max(500),
});

/** POST /api/admin/providers/:id/reject — fail KYC with a stored reason. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const admin = await requireAdmin();
    if (!admin) return fail('Akses ditolak.', 403);

    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);
    const { reason } = rejectSchema.parse(body);

    const profile = await prisma.providerProfile.findUnique({
      where: { id },
      select: {
        id: true,
        user: { select: { name: true, phone: true } },
      },
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
        identityStatus: 'REJECTED',
        identityRejectedReason: reason,
        identityVerifiedAt: null,
        verifiedByAdminId: admin.id,
      },
    });

    await recordAudit({
      actorId: admin.id,
      action: AuditAction.KycReject,
      targetType: 'ProviderProfile',
      targetId: profile.id,
      metadata: { name: profile.user.name, reason },
    });

    return ok({ id: profile.id, kycStatus: 'REJECTED', identityStatus: 'REJECTED' });
  })();
}
