import prisma from '@/lib/prisma';
import { ok, fail, handle } from '@/lib/api';
import { requireAdmin } from '@/lib/admin-guard';
import { maskNik } from '@/lib/provider-verification';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return fail('Akses ditolak.', 403);

    const profile = await prisma.providerProfile.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        category: true,
        districts: true,
        dailyRate: true,
        bio: true,
        goPayNumber: true,
        payoutMethod: true,
        payoutDetails: true,
        isVerified: true,
        kycStatus: true,
        kycReason: true,
        kycReviewedAt: true,
        nikLast4: true,
        identityStatus: true,
        identitySubmittedAt: true,
        identityVerifiedAt: true,
        identityRejectedReason: true,
        phoneVerifiedAt: true,
        payoutStatus: true,
        payoutVerifiedAt: true,
        createdAt: true,
        user: { select: { name: true, phone: true, email: true } },
      },
    });
    if (!profile) return fail('Profil tukang tidak ditemukan.', 404);

    return ok({
      id: profile.id,
      name: profile.user.name,
      phone: profile.user.phone,
      email: profile.user.email,
      category: profile.category,
      districts: profile.districts,
      dailyRate: profile.dailyRate,
      bio: profile.bio,
      goPayNumber: profile.goPayNumber,
      payoutMethod: profile.payoutMethod,
      payoutDetails: profile.payoutDetails,
      isVerified: profile.isVerified,
      kycStatus: profile.kycStatus,
      kycReason: profile.kycReason,
      kycReviewedAt: profile.kycReviewedAt?.toISOString() ?? null,
      nikMasked: maskNik(profile.nikLast4),
      identityStatus: profile.identityStatus,
      identitySubmittedAt: profile.identitySubmittedAt?.toISOString() ?? null,
      identityVerifiedAt: profile.identityVerifiedAt?.toISOString() ?? null,
      identityRejectedReason: profile.identityRejectedReason,
      phoneVerifiedAt: profile.phoneVerifiedAt?.toISOString() ?? null,
      payoutStatus: profile.payoutStatus,
      payoutVerifiedAt: profile.payoutVerifiedAt?.toISOString() ?? null,
      createdAt: profile.createdAt.toISOString(),
    });
  })();
}
