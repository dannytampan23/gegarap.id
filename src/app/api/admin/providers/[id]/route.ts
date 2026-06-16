import prisma from '@/lib/prisma';
import { ok, fail, handle } from '@/lib/api';
import { requireAdmin } from '@/lib/admin-guard';
import { getKtpSignedUrl } from '@/lib/storage';

// Auth-gated (reads session headers) — never prerender.
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/providers/:id — full KYC review detail for one provider,
 * including payout details and a short-lived signed URL to preview the KTP.
 * The signed URL (≈2 min TTL) is minted on demand and never persisted.
 */
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
        ktpImageUrl: true,
        createdAt: true,
        user: { select: { name: true, phone: true, email: true } },
      },
    });
    if (!profile) return fail('Profil tukang tidak ditemukan.', 404);

    const ktpUrl = await getKtpSignedUrl(profile.ktpImageUrl);

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
      hasKtp: Boolean(profile.ktpImageUrl),
      ktpUrl, // short-lived signed URL (or null) — for preview only
      createdAt: profile.createdAt.toISOString(),
    });
  })();
}
