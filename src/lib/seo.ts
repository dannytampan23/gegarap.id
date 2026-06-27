import type { Metadata } from 'next';
import { SITE } from './site';

/** Canonical production origin. Keep in sync with `metadataBase` in the root layout. */
export const BASE_URL = 'https://gegarap.id';

/**
 * Build per-page metadata with UNIQUE Open Graph + Twitter tags.
 *
 * Next.js does not copy a page's `title`/`description` into `openGraph`/`twitter`
 * automatically — without this, every page would inherit the root layout's OG
 * tags and share identically on WhatsApp/social. This helper guarantees each
 * page gets its own preview, plus a canonical URL.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = `${BASE_URL}${path}`;
  // Mirror the root title template ("%s · gegarap.id") for OG/Twitter, which
  // do not pick up the template the way the document <title> does.
  const fullTitle = `${title} · ${SITE.name}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE.name,
      locale: 'id_ID',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
  };
}

/**
 * JSON-LD `LocalBusiness` describing gegarap.id, for rich snippets in Google
 * (rating stars, service area). `aggregateRating` is included ONLY when there
 * are real reviews — never fabricate ratings.
 */
export function localBusinessJsonLd({
  ratingValue,
  reviewCount,
}: {
  ratingValue: number;
  reviewCount: number;
}): Record<string, unknown> {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${BASE_URL}/#business`,
    name: SITE.name,
    description:
      'Marketplace jasa tukang hyper-local di Yogyakarta — tukang ledeng, listrik, dan kebersihan yang sudah terverifikasi KTP.',
    url: BASE_URL,
    // Only advertise contact channels that are actually configured.
    ...(SITE.contact.wa ? { telephone: `+${SITE.contact.wa}` } : {}),
    ...(SITE.contact.email ? { email: SITE.contact.email } : {}),
    priceRange: 'Rp',
    areaServed: {
      '@type': 'AdministrativeArea',
      name: SITE.area,
    },
    address: {
      '@type': 'PostalAddress',
      addressRegion: 'DI Yogyakarta',
      addressCountry: 'ID',
    },
  };

  if (reviewCount > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(ratingValue.toFixed(1)),
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return data;
}
