import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { ok, fail, handle } from '@/lib/api';
import { onboardingSchema } from '@/lib/validations';
import { PROVIDER_PUBLIC_SELECT } from '@/lib/providers';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export async function GET(req: Request) {
  return handle(async () => {
    // Basic abuse protection on a public, unauthenticated endpoint.
    const limit = rateLimit(`providers:${clientIp(req)}`, { windowMs: 60_000, max: 60 });
    if (!limit.ok) {
      return fail(`Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.`, 429);
    }

    // STRICT projection: only verified + available providers, and only the
    // public-safe columns (no payout, no KTP, no exact coordinates). Never use
    // `include` here — it would return the whole row including sensitive PII.
    const providers = await prisma.providerProfile.findMany({
      where: { isVerified: true, available: true },
      select: PROVIDER_PUBLIC_SELECT,
      orderBy: { rating: 'desc' },
    });
    return ok(providers);
  })();
}

export async function POST(req: Request) {
  return handle(async () => {
    // Onboarding requires an authenticated session — no anonymous profiles.
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return fail('Harus login dulu untuk mendaftar sebagai tukang.', 401);
    }

    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);

    const input = onboardingSchema.parse(body);

    // Identity comes from the session, never the body. The profile is tied to
    // the logged-in user; upsert keyed by userId so re-submitting edits it
    // instead of erroring or duplicating.
    const profile = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: { name: input.name, role: 'PROVIDER' },
      });

      return tx.providerProfile.upsert({
        where: { userId: session.user.id },
        update: {
          category: input.category,
          districts: input.districts,
          dailyRate: input.dailyRate,
          goPayNumber: input.goPayNumber,
          bio: input.bio || null,
          ktpImageUrl: input.ktpImageUrl ?? undefined,
          // Re-submitting after a rejection puts the profile back in review.
          kycStatus: 'PENDING',
          kycReason: null,
        },
        create: {
          userId: session.user.id,
          category: input.category,
          districts: input.districts,
          dailyRate: input.dailyRate,
          goPayNumber: input.goPayNumber,
          bio: input.bio || null,
          ktpImageUrl: input.ktpImageUrl ?? null,
          isVerified: false, // pending KYC review
          kycStatus: 'PENDING',
        },
      });
    });

    return ok({ providerProfileId: profile.id, name: input.name }, 201);
  })();
}
