import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/firebase/session';
import { CustomerBookings, type CustomerBooking } from '@/components/dashboard/CustomerBookings';
import { CompleteWhatsAppPrompt } from '@/components/dashboard/CompleteWhatsAppPrompt';
import { ToolsSection } from '@/components/dashboard/ToolsSection';
import { isContactUnlocked } from '@/lib/authz';

export const metadata: Metadata = { title: 'Dashboard Saya' };
export const dynamic = 'force-dynamic';

export default async function CustomerDashboard() {
  const session = await getSession();
  if (!session?.user?.id) redirect('/login?redirect=/dashboard');

  const jobs = await prisma.job.findMany({
    where: { customerId: session.user.id },
    select: {
      id: true,
      description: true,
      customerAddress: true,
      district: true,
      status: true,
      scheduledDate: true,
      timeSlot: true,
      estimatedDays: true,
      totalFee: true,
      dpAmount: true,
      createdAt: true,
      provider: { select: { category: true, user: { select: { name: true, phone: true } } } },
      payment: { select: { status: true } },
      review: { select: { rating: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const bookings: CustomerBooking[] = jobs.map((j) => ({
    id: j.id,
    providerName: j.provider.user.name,
    // Provider contact opens to the customer only after the DP is paid (same
    // PROTECTED tier as the provider side), surfaced as a wa.me click-to-chat.
    providerWaNumber: isContactUnlocked(j.payment?.status) ? j.provider.user.phone : null,
    category: j.provider.category,
    description: j.description ?? '',
    address: j.customerAddress,
    district: j.district ?? '',
    status: j.status,
    scheduledDate: j.scheduledDate ? j.scheduledDate.toISOString() : null,
    timeSlot: j.timeSlot ?? '',
    estimatedDays: j.estimatedDays,
    totalFee: j.totalFee,
    dpAmount: j.dpAmount,
    paymentStatus: j.payment?.status ?? null,
    reviewRating: j.review?.rating ?? null,
    createdAt: j.createdAt.toISOString(),
  }));

  return (
    <div className="container py-10 sm:py-14">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Dashboard Saya
        </h1>
        <p className="mt-2 text-muted-foreground">Pantau status booking dan riwayat pekerjaan Anda.</p>
      </div>

      {/* Non-blocking nudge for accounts (e.g. Google sign-ups) without a WA number. */}
      {!session.user.phone && <CompleteWhatsAppPrompt />}

      <ToolsSection />

      <CustomerBookings bookings={bookings} />
    </div>
  );
}
