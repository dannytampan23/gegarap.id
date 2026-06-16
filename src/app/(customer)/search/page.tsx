import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { SearchClient } from '@/components/providers/SearchClient';
import { PROVIDER_PUBLIC_SELECT } from '@/lib/providers';
import type { ProviderListItem } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Cari Tukang',
  description:
    'Temukan tukang terverifikasi di sekitar Anda — filter berdasarkan kategori dan harga.',
};

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  // Only verified providers, and only public-safe columns reach the client.
  const providers = (await prisma.providerProfile.findMany({
    where: { isVerified: true, available: true },
    select: PROVIDER_PUBLIC_SELECT,
    orderBy: { rating: 'desc' },
  })) as ProviderListItem[];

  return (
    <div className="container py-10 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Temukan tukang terbaik
        </h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          Semua mitra telah melewati verifikasi KYC. Pilih, booking, dan bayar DP dengan aman.
        </p>
      </div>

      <SearchClient providers={providers} initialCategory={searchParams.category ?? 'Semua'} />
    </div>
  );
}
