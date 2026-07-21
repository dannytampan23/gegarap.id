/**
 * RAG retrieval for the AI assistant (System 4).
 *
 * Per the chosen approach this is a STRUCTURED + KEYWORD search over the real
 * `ProviderProfile` table via Prisma (no embeddings/pgvector): pre-filter by
 * kota/layanan/budget, rank by trust signals, drop fraud-suspicious rows, and
 * return a small client-safe shortlist that gets injected into the model prompt
 * for final ranking. Only verified, available providers are ever surfaced, and
 * the projection reuses the public DTO gate so no PII leaks.
 */

import prisma from '@/lib/prisma';
import { PROVIDER_PUBLIC_SELECT } from '@/lib/providers';
import { calculateFraudScore, fraudBadge, FRAUD_EXCLUDE_THRESHOLD } from './fraud';
import type { ExtractedFilters } from './extract';

export interface SearchedProvider {
  id: string;
  name: string;
  category: string;
  categories: string[];
  districts: string[];
  dailyRate: number;
  rating: number;
  ratingCount: number;
  completedJobs: number;
  bio: string | null;
  avatarUrl: string | null;
  /** "baru" → show a "Baru bergabung" caution badge; null → normal. */
  fraudBadge: 'baru' | null;
}

/** How many candidates to pull before fraud-filtering down to the final set. */
const CANDIDATE_LIMIT = 12;
const RESULT_LIMIT = 5;

export async function searchProviders(
  _query: string,
  filters: ExtractedFilters = {}
): Promise<SearchedProvider[]> {
  // Only ever surface verified + open providers (mirrors the booking gate).
  const where: Record<string, unknown> = { isVerified: true, available: true };

  if (filters.kota) where.districts = { has: filters.kota };
  if (filters.budgetMax) where.dailyRate = { lte: filters.budgetMax };
  if (filters.layanan) {
    where.OR = [{ category: filters.layanan }, { categories: { has: filters.layanan } }];
  }

  const rows = await prisma.providerProfile.findMany({
    where,
    select: { ...PROVIDER_PUBLIC_SELECT, categories: true, createdAt: true },
    orderBy: [{ rating: 'desc' }, { completedJobs: 'desc' }, { ratingCount: 'desc' }],
    take: CANDIDATE_LIMIT,
  });

  const scored: SearchedProvider[] = [];
  for (const r of rows) {
    const score = calculateFraudScore({
      dailyRate: r.dailyRate,
      rating: r.rating,
      ratingCount: r.ratingCount,
      createdAt: r.createdAt,
    });
    if (score >= FRAUD_EXCLUDE_THRESHOLD) continue; // hide outright

    scored.push({
      id: r.id,
      name: r.user.name,
      category: r.category,
      categories: r.categories,
      districts: r.districts,
      dailyRate: r.dailyRate,
      rating: r.rating,
      ratingCount: r.ratingCount,
      completedJobs: r.completedJobs,
      bio: r.bio,
      avatarUrl: r.avatarUrl,
      fraudBadge: fraudBadge(score),
    });
    if (scored.length >= RESULT_LIMIT) break;
  }

  return scored;
}
