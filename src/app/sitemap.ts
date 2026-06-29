import type { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/seo';
import prisma from '@/lib/prisma';

// Regenerate hourly (ISR) rather than per-request, and never let a DB hiccup
// fail the build — fall back to the static routes only.
export const revalidate = 3600;

const STATIC_PATHS: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/search', priority: 0.9, changeFrequency: 'daily' },
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

  return [...staticEntries, ...articleEntries];
}
