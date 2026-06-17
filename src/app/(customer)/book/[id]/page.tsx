import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import prisma from '@/lib/prisma';
import { resolveFee } from '@/lib/fee-config';
import BookingForm from './BookingForm';

export const metadata: Metadata = {
  title: 'Booking Tukang',
};

interface BookingPageProps {
  params: { id: string };
}

export default async function BookingPage({ params }: BookingPageProps) {
  const provider = await prisma.providerProfile.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      category: true,
      dailyRate: true,
      rating: true,
      ratingCount: true,
      isVerified: true,
      available: true,
      user: { select: { name: true } },
    },
  });

  // Only verified, available providers are bookable.
  if (!provider || !provider.isVerified || !provider.available) notFound();

  // Resolve the category's fee rule so the form's DP/total estimate matches the
  // amount the server will actually charge (campaign ids are server-only).
  const fee = await resolveFee(provider.category);
  const feeRule = {
    platformFeePercent: fee.platformFeePercent,
    dpPercent: fee.dpPercent,
    minDpThresholdAmount: fee.minDpThresholdAmount,
    highValueDpPercent: fee.highValueDpPercent,
    campaignFeePercent: fee.campaignFeePercent,
  };

  return (
    <div className="container py-10 sm:py-14">
      <Link
        href="/search"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke pencarian
      </Link>

      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Formulir Booking
        </h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          Lengkapi detail pekerjaan Anda. Pembayaran DP mengamankan jadwal dengan tukang.
        </p>
      </div>

      <BookingForm
        provider={{
          id: provider.id,
          name: provider.user.name,
          category: provider.category,
          dailyRate: provider.dailyRate,
          rating: provider.rating,
          ratingCount: provider.ratingCount,
        }}
        feeRule={feeRule}
      />
    </div>
  );
}
