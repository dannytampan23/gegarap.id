/**
 * Grounded internal linking for the content engine (System 5).
 *
 * The model proposes link *ideas* (anchor text), but the actual `href` is always
 * built here from REAL site routes + REAL related-article slugs — never trusted
 * from the LLM. This keeps the "Marketplace Growth Engineer" links from 404-ing
 * and guarantees every article funnels toward the category search + booking flow.
 */

import type { ContentCategory, InternalLink } from './schema';

/** Category → the public search route that lists that kind of tukang. */
export function categorySearchHref(category: ContentCategory): string {
  return `/search?category=${encodeURIComponent(category)}`;
}

export interface RelatedArticle {
  slug: string;
  title: string;
  category: string;
}

/**
 * Build the final, click-safe internal links for an article:
 *  1. the category search page (the primary conversion path),
 *  2. up to 3 same-category published articles (topical clustering for SEO),
 *  3. the AI assistant, as a soft secondary CTA.
 * De-duplicated by href; the article's own slug is excluded.
 */
export function buildInternalLinks(input: {
  category: ContentCategory;
  selfSlug: string;
  related: RelatedArticle[];
}): InternalLink[] {
  const { category, selfSlug, related } = input;
  const links: InternalLink[] = [
    { label: `Lihat semua ${category} terverifikasi`, href: categorySearchHref(category) },
  ];

  for (const r of related) {
    if (r.slug === selfSlug) continue;
    if (r.category !== category) continue;
    links.push({ label: r.title, href: `/artikel/${r.slug}` });
    if (links.length >= 4) break;
  }

  links.push({ label: 'Tanya asisten AI gegarap.id', href: '/asisten' });

  // De-dup by href, preserve order.
  const seen = new Set<string>();
  return links.filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true)));
}
