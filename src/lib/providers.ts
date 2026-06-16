import type { Prisma } from '@prisma/client';
import type { ProviderListItem, ProviderMapItem } from './types';

/**
 * The ONLY ProviderProfile fields that may ever leave the server for an
 * unauthenticated/public consumer.
 *
 * Deliberately EXCLUDED (never expose): goPayNumber, payoutMethod, payoutDetails
 * (financial), ktpImageUrl (KYC document), latitude/longitude (exact home
 * location), userId, and any audit/KYC review metadata. Use this `select`
 * everywhere providers are listed publicly — never `include`, which returns the
 * whole row including the sensitive columns above.
 */
export const PROVIDER_PUBLIC_SELECT = {
  id: true,
  category: true,
  districts: true,
  dailyRate: true,
  bio: true,
  avatarUrl: true,
  rating: true,
  ratingCount: true,
  completedJobs: true,
  available: true,
  user: { select: { name: true } },
} satisfies Prisma.ProviderProfileSelect;

/**
 * Public projection PLUS coarse coordinates, for the marketplace map only.
 * Coordinates MUST be passed through {@link toMapProvider} before reaching the
 * client so the precise home location is never revealed.
 */
export const PROVIDER_MAP_SELECT = {
  id: true,
  category: true,
  dailyRate: true,
  latitude: true,
  longitude: true,
  user: { select: { name: true } },
} satisfies Prisma.ProviderProfileSelect;

/**
 * Reduce a precise home coordinate to an approximate ~1 km area. Two decimal
 * places ≈ 1.1 km at this latitude, which is enough to show "tukang near you"
 * on a map without disclosing a provider's exact address.
 */
export function fuzzCoordinate(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(value * 100) / 100;
}

type RawMapProvider = {
  id: string;
  category: string;
  dailyRate: number;
  latitude: number | null;
  longitude: number | null;
  user: { name: string };
};

/** Project a raw row into the client-safe map shape with fuzzed coordinates. */
export function toMapProvider(p: RawMapProvider): ProviderMapItem {
  return {
    id: p.id,
    category: p.category,
    dailyRate: p.dailyRate,
    latitude: fuzzCoordinate(p.latitude),
    longitude: fuzzCoordinate(p.longitude),
    user: { name: p.user.name },
  };
}

/** Compile-time guarantee the public select matches the client list type. */
export type PublicProviderRow = ProviderListItem;
