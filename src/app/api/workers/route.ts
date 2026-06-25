import prisma from '@/lib/prisma';
import { fuzzCoordinate } from '@/lib/providers';
import { rateLimit, clientIp, recordRateLimitBreach } from '@/lib/rate-limit';
import { logAlert, notifyOps } from '@/lib/logger';
import { NextResponse } from 'next/server';

/**
 * Public marketplace map feed: `GET /api/workers?lat=..&lng=..&radius=10`.
 *
 * Spec calls these "workers"; the real domain entity is a ProviderProfile, so we
 * read that table and project ONLY map-safe fields. Exact home coordinates are
 * NEVER returned — they are reduced to a ~1 km grid via fuzzCoordinate, and the
 * radius filter runs against those fuzzed points. No payout/KTP/NIK leaves here.
 */
export interface MapWorker {
  id: string;
  name: string;
  category: string;
  rating: number;
  ratingCount: number;
  dailyRate: number;
  latitude: number;
  longitude: number;
}

const YOGYA: [number, number] = [-7.7956, 110.3695];
const DEFAULT_RADIUS_KM = 10;

/** Great-circle distance in km between two lat/lng points. */
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function parseNum(v: string | null): number | null {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  // Same abuse protection as /api/providers — this is a public directory feed.
  const ip = clientIp(req);
  const limit = await rateLimit(`workers:${ip}`, { windowMs: 60_000, max: 30 });
  if (!limit.ok) {
    if (recordRateLimitBreach(`workers-breach:${ip}`)) {
      logAlert('SEARCH_SCRAPING_SUSPECTED', { ip });
      await notifyOps('SEARCH_SCRAPING_SUSPECTED', { ip, endpoint: '/api/workers' });
    }
    return NextResponse.json(
      { ok: false, message: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.` },
      { status: 429 }
    );
  }

  const url = new URL(req.url);
  const lat = parseNum(url.searchParams.get('lat')) ?? YOGYA[0];
  const lng = parseNum(url.searchParams.get('lng')) ?? YOGYA[1];
  const radius = Math.min(Math.max(parseNum(url.searchParams.get('radius')) ?? DEFAULT_RADIUS_KM, 1), 100);

  // Only verified, available providers that actually have a location to plot.
  const rows = await prisma.providerProfile.findMany({
    where: {
      isVerified: true,
      available: true,
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      category: true,
      dailyRate: true,
      rating: true,
      ratingCount: true,
      latitude: true,
      longitude: true,
      user: { select: { name: true } },
    },
    orderBy: { rating: 'desc' },
  });

  const workers: MapWorker[] = rows
    .map((p) => {
      // Fuzz BEFORE any distance math so we never even compute against the real point.
      const flat = fuzzCoordinate(p.latitude);
      const flng = fuzzCoordinate(p.longitude);
      if (flat === null || flng === null) return null;
      return {
        id: p.id,
        name: p.user.name,
        category: p.category,
        rating: p.rating,
        ratingCount: p.ratingCount,
        dailyRate: p.dailyRate,
        latitude: flat,
        longitude: flng,
      };
    })
    .filter((w): w is MapWorker => w !== null)
    .filter((w) => haversineKm(lat, lng, w.latitude, w.longitude) <= radius);

  return NextResponse.json(workers);
}
