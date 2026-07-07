import prisma from '@/lib/prisma';
import { ok, fail, handle } from '@/lib/api';
import { requireAdmin } from '@/lib/admin-guard';
import { maskNik } from '@/lib/provider-verification';

// Auth-gated (reads session headers) — never prerender.
export const dynamic = 'force-dynamic';

/** GET /api/admin/providers/pending — providers awaiting KYC review. */
export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!admin) return fail('Akses ditolak.', 403);

    const pending = await prisma.providerProfile.findMany({
      where: { kycStatus: 'PENDING' },
      select: {
        id: true,
        category: true,
        districts: true,
        dailyRate: true,
        nikLast4: true,
        identityStatus: true,
        payoutStatus: true,
        createdAt: true,
        user: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' }, // oldest first — review queue
    });

    // Don't leak the storage path; just signal whether a document was uploaded.
    const rows = pending.map((p) => ({
      id: p.id,
      name: p.user.name,
      phone: p.user.phone,
      category: p.category,
      districts: p.districts,
      dailyRate: p.dailyRate,
      nikMasked: maskNik(p.nikLast4),
      identityStatus: p.identityStatus,
      payoutStatus: p.payoutStatus,
      createdAt: p.createdAt.toISOString(),
    }));

    return ok(rows);
  })();
}
