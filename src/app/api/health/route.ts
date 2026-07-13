import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type HealthStatus = 'ok' | 'degraded';

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return healthResponse('ok', 200, startedAt, {
      database: 'ok',
      cronAuth: process.env.CRON_SECRET ? 'configured' : 'missing',
      payout:
        process.env.DISBURSEMENT_PROVIDER === 'gateway'
          ? 'gateway'
          : process.env.DISBURSEMENT_PROVIDER === 'disabled'
            ? 'disabled'
            : 'unsafe-default-blocked',
    });
  } catch (error) {
    console.error('[api/health] database check failed:', error);

    return healthResponse('degraded', 503, startedAt, {
      database: 'unavailable',
    });
  }
}

function healthResponse(
  status: HealthStatus,
  httpStatus: 200 | 503,
  startedAt: number,
  checks: Record<string, string> = { database: 'ok' }
) {
  return NextResponse.json(
    {
      ok: status === 'ok',
      status,
      checks,
      service: 'gegarap-id',
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      region: process.env.VERCEL_REGION ?? 'unknown',
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
