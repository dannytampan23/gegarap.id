import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CheckCircle2, Clock, Wallet, Briefcase, IdCard, ShieldCheck } from 'lucide-react';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/firebase/session';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { JobsTable, type JobRow } from '@/components/dashboard/JobsTable';
import { isContactUnlocked } from '@/lib/authz';
import { formatCurrency } from '@/lib/utils';
import { maskNik } from '@/lib/provider-verification';

export const metadata: Metadata = { title: 'Dashboard Tukang' };
export const dynamic = 'force-dynamic';

export default async function ProviderDashboard() {
  const session = await getSession();
  if (!session?.user?.id) redirect('/login?redirect=/provider/dashboard');

  // The profile belonging to the logged-in user — this is the filter that was
  // missing before (every provider could see every other provider's jobs + PII).
  const provider = await prisma.providerProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      category: true,
      available: true,
      identityStatus: true,
      identitySubmittedAt: true,
      identityVerifiedAt: true,
      identityRejectedReason: true,
      nikLast4: true,
      payoutStatus: true,
      payoutVerifiedAt: true,
    },
  });
  if (!provider) redirect('/dashboard'); // not a provider → customer dashboard

  const jobs = await prisma.job.findMany({
    where: { providerProfileId: provider.id }, // WAJIB: only this provider's jobs
    include: {
      customer: { select: { name: true } },
      payment: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // PROTECTED tier (Bagian 3): the customer's phone + full address open to the
  // provider only AFTER the DP is paid. Before that they're withheld, so an
  // unpaid/pending booking never leaks a customer's contact to the client.
  const rows: JobRow[] = jobs.map((j) => {
    const contactUnlocked = isContactUnlocked(j.payment?.status);
    return {
      id: j.id,
      customerName: j.customer.name,
      customerWaNumber: contactUnlocked ? j.customerWaNumber : null,
      customerAddress: contactUnlocked ? j.customerAddress : null,
      estimatedDays: j.estimatedDays,
      totalFee: j.totalFee,
      status: j.status,
      createdAt: j.createdAt.toISOString(),
    };
  });

  const stats = {
    completed: jobs.filter((j) => j.status === 'COMPLETED').length,
    active: jobs.filter((j) => j.status === 'CONFIRMED' || j.status === 'IN_PROGRESS').length,
    // Earnings = disbursed payouts. Post-overhaul the released status is RELEASED
    // (the old 'DISBURSED' no longer exists), with the amount on disbursedAmount.
    earnings: jobs
      .filter((j) => j.payment?.status === 'RELEASED')
      .reduce((sum, j) => sum + (j.payment?.disbursedAmount ?? j.payment?.providerAmount ?? 0), 0),
  };

  return (
    <div className="container py-10 sm:py-14">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Dashboard Tukang
          </h1>
          <p className="mt-2 text-muted-foreground">
            Selamat datang, {provider.category} · kelola pekerjaan masuk Anda.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Status:</span>
          <Badge variant={provider.available ? 'success' : 'neutral'} className="px-3 py-1.5">
            <span
              className={`h-2 w-2 rounded-full ${provider.available ? 'bg-emerald-500' : 'bg-slate-400'}`}
            />
            {provider.available ? 'Tersedia' : 'Tidak tersedia'}
          </Badge>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard
          label="Status Identitas"
          value={identityStatusLabel(provider.identityStatus)}
          icon={<ShieldCheck className="h-5 w-5" />}
          hint={`NIK ${maskNik(provider.nikLast4)}`}
        />
        <StatCard
          label="Status Rekening"
          value={payoutStatusLabel(provider.payoutStatus)}
          icon={<IdCard className="h-5 w-5" />}
          hint={
            provider.payoutVerifiedAt
              ? `Diverifikasi ${provider.payoutVerifiedAt.toLocaleDateString('id-ID')}`
              : 'Belum diverifikasi'
          }
        />
        <StatCard
          label="Pekerjaan Selesai"
          value={String(stats.completed)}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Pekerjaan Aktif"
          value={String(stats.active)}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      <div className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <StatCard
          label="Total Pendapatan"
          value={formatCurrency(stats.earnings)}
          icon={<Wallet className="h-5 w-5" />}
        />
        <StatCard
          label="Status Pendaftaran"
          value={provider.available ? 'Aktif menerima booking' : 'Tidak tersedia'}
          icon={<CheckCircle2 className="h-5 w-5" />}
          hint="Status ketersediaan dapat dipakai untuk mengatur jadwal kerja."
        />
      </div>

      <div className="mb-5 flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold tracking-tight text-foreground">Pekerjaan Masuk</h2>
      </div>

      <JobsTable jobs={rows} />
    </div>
  );
}

function identityStatusLabel(status: string): string {
  switch (status) {
    case 'PHONE_VERIFIED':
      return 'Nomor HP terverifikasi';
    case 'IDENTITY_SUBMITTED':
      return 'Identitas diajukan';
    case 'MANUALLY_VERIFIED':
      return 'Terverifikasi Gegarap';
    case 'REJECTED':
      return 'Ditolak';
    case 'SUSPENDED':
      return 'Ditangguhkan';
    default:
      return 'Belum diverifikasi';
  }
}

function payoutStatusLabel(status: string): string {
  switch (status) {
    case 'SUBMITTED':
      return 'Rekening diajukan';
    case 'VERIFIED':
      return 'Rekening terverifikasi';
    case 'REJECTED':
      return 'Rekening ditolak';
    default:
      return 'Belum diverifikasi';
  }
}
