import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Wallet, AlertTriangle } from 'lucide-react';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-guard';
import { formatCurrency } from '@/lib/utils';
import { PAYMENT_STATUSES, STATUS_LABELS, type PaymentStatus } from '@/lib/payment-state';

export const metadata: Metadata = { title: 'Admin · Transaksi' };
export const dynamic = 'force-dynamic';

const FILTERS = ['ALL', 'PENDING', 'PAID', 'HELD', 'DISPUTED', 'RELEASED', 'REFUNDED', 'FAILED'] as const;

const TONE_CLASS: Record<string, string> = {
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  success: 'bg-green-50 text-green-700 ring-green-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
};

function StatusChip({ status }: { status: string }) {
  const tone = (STATUS_LABELS[status as PaymentStatus]?.tone ?? 'info') as string;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE_CLASS[tone]}`}>
      {status}
    </span>
  );
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const admin = await requireAdmin();
  if (!admin) redirect('/');

  const status = searchParams.status?.toUpperCase();
  const where =
    status && status !== 'ALL' && (PAYMENT_STATUSES as readonly string[]).includes(status)
      ? { status }
      : {};

  const [payments, disputeCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        job: {
          include: {
            customer: { select: { name: true, phone: true } },
            provider: { include: { user: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.payment.count({ where: { status: 'DISPUTED' } }),
  ]);

  return (
    <div className="container py-10 sm:py-14">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-light/60 px-3.5 py-1.5 text-sm font-semibold text-primary-800">
            <Wallet className="h-4 w-4" />
            Panel Admin
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Transaksi Pembayaran</h1>
        </div>
        {disputeCount > 0 && (
          <Link
            href="/admin/payments?status=DISPUTED"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-800"
          >
            <AlertTriangle className="h-4 w-4" />
            {disputeCount} sengketa menunggu
          </Link>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (status ?? 'ALL') === f || (!status && f === 'ALL');
          return (
            <Link
              key={f}
              href={f === 'ALL' ? '/admin/payments' : `/admin/payments?status=${f}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset ${active ? 'bg-primary text-white ring-primary' : 'bg-card text-muted-foreground ring-border hover:text-foreground'}`}
            >
              {f}
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Order</th>
              <th className="px-4 py-3 font-semibold">Customer → Tukang</th>
              <th className="px-4 py-3 font-semibold">Nominal</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Tanggal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Tidak ada transaksi.
                </td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/admin/payments/${p.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                    {(p.midtransOrderId ?? p.id).slice(-12)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="text-foreground">{p.job.customer.name ?? p.job.customer.phone}</span>
                  <span className="text-muted-foreground"> → {p.job.provider.user.name}</span>
                </td>
                <td className="px-4 py-3 font-semibold text-foreground">{formatCurrency(p.amount)}</td>
                <td className="px-4 py-3"><StatusChip status={p.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{p.createdAt.toLocaleDateString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
