import prisma from '@/lib/prisma';
import { getSession } from '@/lib/firebase/session';
import { ok, fail, handle } from '@/lib/api';
import { kycOnboardingSchema } from '@/lib/validations';
import { hashNik, nikLast4 } from '@/lib/provider-verification';
import { enqueueIdentitySync } from '@/lib/identity-sync';

/**
 * Provider identity onboarding submission: `POST /api/onboarding`.
 *
 * Identity (userId) comes from the session, never the body. The profile is
 * upserted by userId so re-submitting after a rejection edits in place and goes
 * back into PENDING review. Raw NIK is never stored by this route; only a hash
 * and last 4 digits are saved. `category` keeps the primary skill for legacy
 * queries while `categories` holds the full multi-select.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await getSession();
    if (!session?.user?.id) {
      return fail('Harus login dulu untuk mendaftar sebagai tukang.', 401);
    }

    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);

    const input = kycOnboardingSchema.parse(body);
    const primaryCategory = input.categories[0];

    const profile = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: { name: input.name, role: 'PROVIDER' },
      });

      const data = {
        category: primaryCategory,
        categories: input.categories,
        districts: input.districts,
        dailyRate: input.dailyRate,
        nik: null,
        nikHash: hashNik(input.nik),
        nikLast4: nikLast4(input.nik),
        identityStatus: 'IDENTITY_SUBMITTED',
        identitySubmittedAt: new Date(),
        identityVerifiedAt: null,
        identityRejectedReason: null,
        verifiedByAdminId: null,
        experienceYears: input.experienceYears,
        serviceRadiusKm: input.serviceRadiusKm,
        ktpImageUrl: null,
        faceImageUrl: null,
        certificateUrl: null,
      };

      const profile = await tx.providerProfile.upsert({
        where: { userId: session.user.id },
        update: {
          ...data,
          // Re-submitting after a rejection puts the profile back in review.
          kycStatus: 'PENDING',
          kycReason: null,
        },
        create: {
          userId: session.user.id,
          ...data,
          isVerified: false,
          kycStatus: 'PENDING',
        },
      });
      await enqueueIdentitySync(tx, { userId: session.user.id });
      return profile;
    });

    return ok({ providerProfileId: profile.id, name: input.name }, 201);
  })();
}
