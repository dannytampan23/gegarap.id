import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Wrench } from 'lucide-react';
import { getSession } from '@/lib/firebase/session';
import { getReceiptData } from '@/lib/receipt';
import { formatCurrency, formatDateTime, formatBookingDate, timeSlotLabel } from '@/lib/utils';
import { ReceiptActions } from './ReceiptActions';

export const metadata: Metadata = { title: 'Nota Pembayaran DP' };
export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user?.id) redirect(`/login?redirect=/booking/${params.id}/receipt`);

  const data = await getReceiptData(params.id);
  if (!data || data.customerId !== session.user.id) notFound();
  // The nota documents a real payment — an unpaid booking has no receipt yet.
  if (!data.isPaid) redirect('/dashboard');

  return (
    <div className="container max-w-2xl py-10 sm:py-14">
      <Link
        href="/dashboard"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Dashboard
      </Link>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/30 p-6 sm:p-7">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
              <Wrench className="h-5 w-5" />
            </span>
            <div>
              <p className="text-lg font-extrabold tracking-tight text-foreground">gegarap.id</p>
              <p className="text-xs text-muted-foreground">Nota Pembayaran DP</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            DP LUNAS
          </span>
        </div>

        <div className="space-y-6 p-6 sm:p-7">
          {/* Transaction */}
          <dl>
            <Row label="No. Transaksi" value={data.orderId ?? `GGR-${data.shortId}`} />
            <Row label="Tanggal Bayar" value={data.paidAt ? formatDateTime(data.paidAt) : '-'} />
            <Row label="Metode Bayar" value={data.paymentMethod ?? '-'} />
          </dl>

          <div className="border-t border-dashed border-border" />

          {/* Booking detail */}
          <div>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Detail Booking
            </h2>
            <dl>
              <Row label="Tukang" value={data.providerName} />
              <Row label="Layanan" value={data.category} />
              <Row
                label="Jadwal"
                value={
                  data.scheduledDate
                    ? `${formatBookingDate(data.scheduledDate)}${data.timeSlot ? ` · ${timeSlotLabel(data.timeSlot)}` : ''}`
                    : '-'
                }
              />
              <Row label="Estimasi" value={`${data.estimatedDays} hari kerja`} />
              <Row
                label="Lokasi"
                value={`${data.address}${data.district ? `, ${data.district}` : ''}`}
              />
            </dl>
          </div>

          <div className="border-t border-dashed border-border" />

          {/* Money */}
          <div>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Rincian Biaya
            </h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Total Biaya Jasa</dt>
                <dd className="font-medium text-foreground">{formatCurrency(data.totalFee)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>DP Dibayar ({data.dpPercent}%)</dt>
                <dd className="font-medium text-foreground">{formatCurrency(data.dpAmount)}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-3">
                <dt className="font-bold text-foreground">Sisa Pelunasan</dt>
                <dd className="font-extrabold text-primary">{formatCurrency(data.remaining)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              Sisa dibayar setelah pekerjaan dikonfirmasi selesai.
            </p>
          </div>

          <ReceiptActions jobId={data.jobId} shortId={data.shortId} />
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Pembayaran aman & ditahan sistem (escrow) hingga pekerjaan selesai.
      </p>
    </div>
  );
}
