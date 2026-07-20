import type { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/seo';
import prisma from '@/lib/prisma';
import { STATIC_ARTICLES } from '@/lib/content/static-articles';

// Regenerate hourly (ISR) rather than per-request, and never let a DB hiccup
// fail the build — fall back to the static routes only.
export const revalidate = 3600;

const STATIC_PATHS: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/search', priority: 0.9, changeFrequency: 'daily' },
  { path: '/tools/material-calculator', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/artikel', priority: 0.8, changeFrequency: 'daily' },
  { path: '/asisten', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/help', priority: 0.3, changeFrequency: 'monthly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((s) => ({
    url: `${BASE_URL}${s.path}`,
    lastModified: now,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
  }));

  let articleEntries: MetadataRoute.Sitemap = [];
  try {
    const articles = await prisma.article.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 5000,
    });
    articleEntries = articles.map((a) => ({
      url: `${BASE_URL}/artikel/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.6,
    }));
  } catch {
    // DB unreachable at build → ship the static sitemap; articles fill in on the
    // next hourly revalidation.
  }

  const knownArticleUrls = new Set(articleEntries.map((entry) => entry.url));
  const staticArticleEntries: MetadataRoute.Sitemap = STATIC_ARTICLES.filter(
    (article) => !knownArticleUrls.has(`${BASE_URL}/artikel/${article.slug}`)
  ).map((article) => ({
    url: `${BASE_URL}/artikel/${article.slug}`,
    lastModified: article.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticEntries, ...articleEntries, ...staticArticleEntries];
}
