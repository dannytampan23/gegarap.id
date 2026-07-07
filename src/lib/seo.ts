import type { Metadata } from 'next';
import { SITE } from './site';

export const BASE_URL = 'https://gegarap.id';

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
  const fullTitle = `${title} - ${SITE.name}`;

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
      'Marketplace jasa tukang hyper-local di Yogyakarta untuk mencari tukang ledeng, listrik, dan kebersihan yang terverifikasi Gegarap.',
    url: BASE_URL,
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
