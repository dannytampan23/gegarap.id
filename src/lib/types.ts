import type { VerificationBadge } from './provider-verification';

/**
 * Client-safe provider shape for listings/cards. Intentionally has no financial
 * fields, no KTP/NIK, and no exact coordinates.
 */
export interface ProviderListItem {
  id: string;
  category: string;
  districts: string[];
  dailyRate: number;
  bio: string | null;
  avatarUrl: string | null;
  rating: number;
  ratingCount: number;
  completedJobs: number;
  available: boolean;
  verificationBadges: VerificationBadge[];
  user: { name: string };
}

/**
 * Client-safe provider shape for the marketplace map. Coordinates here are
 * always the fuzzed approximation produced by toMapProvider.
 */
export interface ProviderMapItem {
  id: string;
  category: string;
  dailyRate: number;
  latitude: number | null;
  longitude: number | null;
  user: { name: string };
}
