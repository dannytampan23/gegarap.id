import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck, Wallet, TrendingUp, CreditCard, Timer, BarChart3, FileText } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-guard';
import { computeBusinessMetrics } from '@/lib/metrics';
import { StatCard } from '@/components/ui/StatCard';
import { AdminKycClient } from './AdminKycClient';

export const metadata: Metadata = { title: 'Admin · Verifikasi KYC' };
export const dynamic = 'force-dynamic';

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function AdminPage() {
  // Middleware already gates /admin/* to ADMIN; this is defence-in-depth.
  const admin = await requireAdmin();
  if (!admin) redirect('/');

  const metrics = await computeBusinessMetrics();

  return (
    <div className="container py-10 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-light/60 px-3.5 py-1.5 text-sm font-semibold text-primary-800">
          <ShieldCheck className="h-4 w-4" />
          Panel Admin
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Verifikasi KYC Tukang
        </h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          Tinjau data identitas dan pencairan tukang yang menunggu persetujuan. Hanya tukang yang
          disetujui yang tampil di marketplace.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link
            href="/admin/payments"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground hover:border-primary hover:text-primary"
          >
            <Wallet className="h-4 w-4" />
            Lihat Transaksi Pembayaran
          </Link>
          <Link
            href="/admin/articles"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground hover:border-primary hover:text-primary"
          >
            <FileText className="h-4 w-4" />
            Mesin Konten SEO
          </Link>
        </div>
      </div>

      {/* Business metrics (Bagian 8/11) */}
      <section className="mb-12">
        <div className="mb-5 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight text-foreground">Metrik Bisnis</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <StatCard
            label="Booking Success Rate"
            value={pct(metrics.booking.successRate)}
            icon={<TrendingUp className="h-5 w-5" />}
            hint={`${metrics.booking.completed} selesai · ${metrics.booking.cancelled} batal`}
          />
          <StatCard
            label="Payment Success Rate"
            value={pct(metrics.payment.successRate)}
            icon={<CreditCard className="h-5 w-5" />}
            hint={`${metrics.payment.paid} sukses · ${metrics.payment.failed} gagal · ${metrics.payment.expired} kedaluwarsa`}
          />
          <StatCard
            label="Rata-rata Respons Tukang"
            value={
              metrics.providerResponse.avgMinutes == null
                ? '—'
                : `${metrics.providerResponse.avgMinutes} mnt`
            }
            icon={<Timer className="h-5 w-5" />}
            hint={
              metrics.providerResponse.sampled > 0
                ? `dari ${metrics.providerResponse.sampled} pekerjaan (bayar → mulai)`
                : 'belum ada data'
            }
          />
        </div>

        {metrics.supply.byCategory.length > 0 && (
          <div className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              Suplai tukang aktif per kategori
            </h3>
            <ul className="flex flex-wrap gap-2">
              {metrics.supply.byCategory.map((c) => (
                <li
                  key={c.category}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm"
                >
                  <span className="font-medium text-foreground">{c.category}</span>
                  <span className="rounded-md bg-primary/10 px-1.5 text-xs font-semibold text-primary">
                    {c.activeProviders}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <AdminKycClient />
    </div>
  );
}
