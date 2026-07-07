import prisma from '@/lib/prisma';
import { SearchClient } from '@/components/providers/SearchClient';
import { PROVIDER_PUBLIC_SELECT, toPublicProvider } from '@/lib/providers';
import { JsonLd } from '@/components/seo/JsonLd';
import { pageMetadata, localBusinessJsonLd } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Cari Tukang',
  description:
    'Temukan tukang terverifikasi di sekitar Anda — filter berdasarkan kategori dan harga.',
  path: '/search',
});

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string };
}) {
  // Only verified providers, and only public-safe columns reach the client.
  const rows = await prisma.providerProfile.findMany({
    where: { isVerified: true, available: true },
    select: PROVIDER_PUBLIC_SELECT,
    orderBy: { rating: 'desc' },
  });
  const providers = rows.map(toPublicProvider);

  const totalReviews = providers.reduce((s, p) => s + p.ratingCount, 0);
  const avgRating =
    totalReviews > 0
      ? providers.reduce((s, p) => s + p.rating * p.ratingCount, 0) / totalReviews
      : 0;

  return (
    <div className="container py-10 sm:py-14">
      <JsonLd data={localBusinessJsonLd({ ratingValue: avgRating, reviewCount: totalReviews })} />
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Temukan tukang terbaik
        </h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          Semua mitra telah melewati verifikasi KYC. Pilih, booking, dan bayar DP dengan aman.
        </p>
      </div>

      <SearchClient
        providers={providers}
        initialCategory={searchParams.category ?? 'Semua'}
        initialQuery={searchParams.q ?? ''}
      />
    </div>
  );
}
