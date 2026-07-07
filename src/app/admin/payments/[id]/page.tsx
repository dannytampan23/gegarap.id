import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-guard';
import { formatCurrency } from '@/lib/utils';
import { customerStatusLabel, providerStatusLabel } from '@/lib/payment-state';
import { ForceActions } from './ForceActions';

export const metadata: Metadata = { title: 'Admin · Detail Transaksi' };
export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

export default async function AdminPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) redirect('/');

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      job: { include: { customer: true, provider: { include: { user: true } } } },
      events: { orderBy: { createdAt: 'asc' } },
      refundRequests: { orderBy: { createdAt: 'desc' } },
      payouts: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!payment) notFound();

  const job = payment.job;

  return (
    <div className="container max-w-4xl py-10 sm:py-14">
      <Link
        href="/admin/payments"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke daftar transaksi
      </Link>

      <div className="mb-2 flex items-center gap-3">
        <h1 className="text-2xl font-extrabold text-foreground">Transaksi</h1>
        <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-bold text-primary">
          {payment.status}
        </span>
      </div>
      <p className="mb-8 font-mono text-xs text-muted-foreground">
        {payment.midtransOrderId ?? payment.id}
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Financials */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-3 font-bold text-foreground">Rincian Dana</h2>
          <dl>
            <Row label="Nominal ditagih (DP)" value={formatCurrency(payment.amount)} />
            <Row label="DP" value={formatCurrency(payment.dpAmount)} />
            <Row label="Sisa" value={formatCurrency(payment.remainingAmount)} />
            <Row label="Fee platform" value={formatCurrency(payment.platformFee)} />
            <Row label="Untuk tukang" value={formatCurrency(payment.providerAmount)} />
            <Row label="Gateway" value={payment.paymentGateway} />
            {payment.disbursedAt && (
              <Row label="Dicairkan" value={payment.disbursedAt.toLocaleString('id-ID')} />
            )}
          </dl>
        </section>

        {/* Parties */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-3 font-bold text-foreground">Pihak & Booking</h2>
          <dl>
            <Row label="Customer" value={job.customer.name ?? job.customer.phone} />
            <Row label="Tukang" value={job.provider.user.name} />
            <Row label="Kategori" value={job.provider.category} />
            <Row label="Status job" value={job.status} />
            <Row label="Label customer" value={customerStatusLabel(payment.status)} />
            <Row label="Label tukang" value={providerStatusLabel(payment.status)} />
          </dl>
        </section>
      </div>

      {/* Audit timeline */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-4 font-bold text-foreground">Audit Log (PaymentEvent)</h2>
        <ol className="space-y-3">
          {payment.events.length === 0 && (
            <li className="text-sm text-muted-foreground">Belum ada event.</li>
          )}
          {payment.events.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div>
                <p className="font-medium text-foreground">
                  {e.fromStatus ?? '∅'} → {e.toStatus}
                  <span className="ml-2 font-normal text-muted-foreground">oleh {e.triggeredBy}</span>
                </p>
                {e.reason && <p className="text-muted-foreground">{e.reason}</p>}
                <p className="text-xs text-muted-foreground">{e.createdAt.toLocaleString('id-ID')}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Refunds & payouts */}
      {(payment.refundRequests.length > 0 || payment.payouts.length > 0) && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 font-bold text-foreground">Refund Request</h2>
            {payment.refundRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {payment.refundRequests.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border p-3">
                    <p className="font-medium text-foreground">
                      {r.type} · {formatCurrency(r.amount ?? 0)} · {r.status}
                    </p>
                    <p className="text-muted-foreground">{r.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 font-bold text-foreground">Payout</h2>
            {payment.payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {payment.payouts.map((p) => (
                  <li key={p.id} className="rounded-lg border border-border p-3">
                    <p className="font-medium text-foreground">
                      {formatCurrency(p.amount)} · {p.status}
                    </p>
                    {p.failureReason && <p className="text-red-600">{p.failureReason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Force actions */}
      <section className="mt-6 rounded-2xl border border-red-200 bg-red-50/40 p-5">
        <h2 className="mb-1 font-bold text-foreground">Tindakan Admin (Force)</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Gunakan hanya bila perlu. Setiap tindakan tercatat di audit log dengan id Anda.
        </p>
        <ForceActions paymentId={payment.id} status={payment.status} />
      </section>
    </div>
  );
}
