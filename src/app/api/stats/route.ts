import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * Public homepage stats. Spec field names ("worker", "review", "job") are mapped
 * onto the real schema:
 *   workerCount → verified ProviderProfile rows
 *   avgRating   → average of Review.rating (1 decimal)
 *   jobCount    → completed Job rows
 *
 * Cached for an hour — these numbers move slowly and the homepage is hot.
 */
export const dynamic = 'force-dynamic';

const STATS_CACHE_SECONDS = 3600;

export interface StatsResponse {
  workerCount: number;
  avgRating: number;
  jobCount: number;
}

export async function GET() {
  try {
    const [workerCount, ratingAgg, jobCount] = await Promise.all([
      prisma.providerProfile.count({ where: { isVerified: true } }),
      prisma.review.aggregate({ _avg: { rating: true } }),
      prisma.job.count({ where: { status: 'COMPLETED' } }),
    ]);

    const avg = ratingAgg._avg.rating;
    const body: StatsResponse = {
      workerCount,
      // Round to 1 decimal; null (no reviews yet) collapses to 0 so the client
      // can hide the section rather than render a misleading rating.
      avgRating: avg === null ? 0 : Math.round(avg * 10) / 10,
      jobCount,
    };

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': `public, s-maxage=${STATS_CACHE_SECONDS}, stale-while-revalidate=${STATS_CACHE_SECONDS}`,
      },
    });
  } catch (err) {
    console.error('[api/stats] error:', err);
    return NextResponse.json({ ok: false, message: 'Gagal memuat statistik.' }, { status: 500 });
  }
}
