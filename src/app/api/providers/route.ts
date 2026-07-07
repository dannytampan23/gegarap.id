import prisma from '@/lib/prisma';
import { getSession } from '@/lib/firebase/session';
import { adminDb } from '@/lib/firebase/admin';
import { ok, fail, handle } from '@/lib/api';
import { onboardingSchema } from '@/lib/validations';
import { PROVIDER_PUBLIC_SELECT, toPublicProvider } from '@/lib/providers';
import { rateLimit, clientIp, recordRateLimitBreach } from '@/lib/rate-limit';
import { logAlert, notifyOps } from '@/lib/logger';
import { hashNik, nikLast4 } from '@/lib/provider-verification';

export async function GET(req: Request) {
  return handle(async () => {
    // Basic abuse protection on a public, unauthenticated endpoint.
    const ip = clientIp(req);
    const limit = await rateLimit(`providers:${ip}`, { windowMs: 60_000, max: 30 });
    if (!limit.ok) {
      // Persistent breaches = likely scraping the provider directory (Bagian 8/9).
      if (recordRateLimitBreach(`providers-breach:${ip}`)) {
        logAlert('SEARCH_SCRAPING_SUSPECTED', { ip });
        await notifyOps('SEARCH_SCRAPING_SUSPECTED', { ip, endpoint: '/api/providers' });
      }
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
    // Defense-in-depth: project through the output DTO gate so no raw Prisma row
    // (and no future sensitive column) can leak even if the select changes.
    return ok(providers.map(toPublicProvider));
  })();
}

export async function POST(req: Request) {
  return handle(async () => {
    // Onboarding requires an authenticated session — no anonymous profiles.
    const session = await getSession();
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
          nik: null,
          nikHash: hashNik(input.nik),
          nikLast4: nikLast4(input.nik),
          identityStatus: 'IDENTITY_SUBMITTED',
          identitySubmittedAt: new Date(),
          identityVerifiedAt: null,
          identityRejectedReason: null,
          verifiedByAdminId: null,
          ktpImageUrl: null,
          faceImageUrl: null,
          certificateUrl: null,
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
          nik: null,
          nikHash: hashNik(input.nik),
          nikLast4: nikLast4(input.nik),
          identityStatus: 'IDENTITY_SUBMITTED',
          identitySubmittedAt: new Date(),
          ktpImageUrl: null,
          faceImageUrl: null,
          certificateUrl: null,
          isVerified: false, // pending KYC review
          kycStatus: 'PENDING',
        },
      });
    });

    // Mirror the role (and name) to the Firestore auth profile so the client
    // UI reflects PROVIDER immediately. Postgres stays authoritative for RBAC.
    await adminDb
      .collection('users')
      .doc(session.user.id)
      .set({ role: 'PROVIDER', name: input.name }, { merge: true });

    return ok({ providerProfileId: profile.id, name: input.name }, 201);
  })();
}
