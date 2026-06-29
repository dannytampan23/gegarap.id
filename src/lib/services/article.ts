/**
 * Article service (System 5) — bridges the content pipeline to persistence.
 *
 * Routes stay thin: they validate + authorise, then call these helpers. The
 * generation pipeline (lib/ai/content) is storage-agnostic; this layer fetches
 * the dedup/linking context from Postgres, runs it, and persists a DRAFT row.
 */

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { PROVIDER_CATEGORIES } from '@/lib/validations';
import {
  generateArticle,
  type GeneratedArticle,
  type RelatedArticle,
} from '@/lib/ai/content';

/** Validates the admin "generate article" request body. */
export const articleGenerateSchema = z.object({
  topic: z.string().trim().min(4, 'Topik terlalu pendek').max(120),
  location: z.string().trim().min(2, 'Lokasi wajib diisi').max(60),
  category: z.enum(PROVIDER_CATEGORIES, { message: 'Pilih kategori' }),
  intent: z.enum(['informational', 'transactional']).default('informational'),
  primaryKeyword: z.string().trim().max(120).optional(),
  secondaryKeywords: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  priceRange: z.string().trim().max(120).optional(),
  commonProblems: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
});

export type ArticleGenerateInput = z.infer<typeof articleGenerateSchema>;

/** Ensure a slug is unique by appending -2, -3, … on collision (bounded). */
async function uniqueSlug(base: string): Promise<string> {
  const root = base || 'artikel';
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const hit = await prisma.article.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!hit) return candidate;
  }
  // Extremely unlikely; fall back to a time-suffixed slug.
  return `${root}-${Date.now().toString(36)}`;
}

export interface CreatedArticle {
  id: string;
  slug: string;
  status: string;
  generatedBy: string;
  article: GeneratedArticle;
}

/**
 * Run the full pipeline for a topic and persist the result as a DRAFT article.
 * Pulls existing titles (dedup) + same-category published posts (internal links)
 * from the DB so generation is grounded in the real catalogue.
 */
export async function createArticleDraft(
  input: ArticleGenerateInput,
  authorId: string | null
): Promise<CreatedArticle> {
  const [existing, relatedRows] = await Promise.all([
    prisma.article.findMany({
      where: { category: input.category },
      select: { title: true },
      take: 200,
    }),
    prisma.article.findMany({
      where: { category: input.category, status: 'PUBLISHED' },
      select: { slug: true, title: true, category: true },
      orderBy: { publishedAt: 'desc' },
      take: 6,
    }),
  ]);

  const result = await generateArticle({
    ...input,
    existingTitles: existing.map((e) => e.title),
    related: relatedRows as RelatedArticle[],
  });

  const slug = await uniqueSlug(result.slug);
  const a = result.article;

  const row = await prisma.article.create({
    data: {
      slug,
      title: a.title,
      metaDescription: a.meta_description,
      contentMarkdown: a.content_markdown,
      faq: a.faq as unknown as Prisma.InputJsonValue,
      internalLinks: a.internal_links as unknown as Prisma.InputJsonValue,
      category: input.category,
      location: input.location,
      primaryKeyword: input.primaryKeyword || input.topic,
      keywords: input.secondaryKeywords,
      intent: input.intent,
      scoreSeo: a.quality_score.seo,
      scoreReadability: a.quality_score.readability,
      scoreValue: a.quality_score.value,
      scoreTrust: a.quality_score.trust,
      scoreConversion: a.quality_score.conversion,
      scoreTotal: a.quality_score.total,
      similarityScore: a.duplicate_check.similarity_score,
      newAngle: a.duplicate_check.new_angle,
      status: 'DRAFT',
      generatedBy: result.generatedBy,
      authorId,
    },
    select: { id: true, slug: true, status: true },
  });

  return { ...row, generatedBy: result.generatedBy, article: { ...a, internal_links: a.internal_links } };
}

/** Admin listing — lightweight columns for the management table. */
export function listArticlesForAdmin() {
  return prisma.article.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      slug: true,
      title: true,
      category: true,
      location: true,
      status: true,
      scoreTotal: true,
      similarityScore: true,
      generatedBy: true,
      publishedAt: true,
      createdAt: true,
    },
  });
}

/** Public list of published articles (newest first), for /artikel. */
export function listPublishedArticles() {
  return prisma.article.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 100,
    select: {
      slug: true,
      title: true,
      metaDescription: true,
      category: true,
      location: true,
      publishedAt: true,
    },
  });
}

/** One published article by slug (or null), for the public detail page. */
export function getPublishedArticle(slug: string) {
  return prisma.article.findFirst({ where: { slug, status: 'PUBLISHED' } });
}
