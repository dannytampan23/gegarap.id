/**
 * Client-safe provider shape for listings/cards. Intentionally has NO financial
 * fields (payout/gopay), NO KTP, and NO coordinates — see PROVIDER_PUBLIC_SELECT
 * in lib/providers.ts, which is the query this type mirrors.
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
  user: { name: string };
}

/**
 * Client-safe provider shape for the marketplace map. Coordinates here are
 * always the fuzzed (~1 km) approximation produced by toMapProvider, never the
 * exact home location.
 */
export interface ProviderMapItem {
  id: string;
  category: string;
  dailyRate: number;
  latitude: number | null;
  longitude: number | null;
  user: { name: string };
}
