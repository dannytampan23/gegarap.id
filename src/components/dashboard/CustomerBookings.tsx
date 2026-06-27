'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarDays,
  MapPin,
  Star,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Hammer,
  CreditCard,
  Receipt,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonVariants } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { TukangIllustration } from '@/components/illustrations/TukangIllustration';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatBookingDate, timeSlotStart, cn } from '@/lib/utils';

export interface CustomerBooking {
  id: string;
  providerName: string;
  category: string;
  description: string;
  address: string;
  district: string;
  status: string;
  scheduledDate: string | null;
  timeSlot: string;
  estimatedDays: number;
  totalFee: number;
  dpAmount: number;
  paymentStatus: string | null;
  reviewRating: number | null;
  createdAt: string;
}

/** Money is "secured" once paid — covers the escrow lifecycle past PAID. */
function isPaid(b: CustomerBooking): boolean {
  return b.paymentStatus === 'PAID' || b.paymentStatus === 'HELD' || b.paymentStatus === 'RELEASED';
}

interface StatusMeta {
  label: string;
  variant: 'warning' | 'info' | 'success' | 'neutral' | 'danger';
  icon: React.ComponentType<{ className?: string }>;
  /** Highest completed step index in [Dibuat, DP Dibayar, Dikonfirmasi, Selesai]; -1 = cancelled. */
  stage: number;
}

function deriveStatus(b: CustomerBooking): StatusMeta {
  if (b.status === 'CANCELLED') return { label: 'Dibatalkan', variant: 'danger', icon: XCircle, stage: -1 };
  if (b.status === 'COMPLETED') return { label: 'Selesai', variant: 'neutral', icon: CheckCircle2, stage: 3 };
  if (b.status === 'IN_PROGRESS') return { label: 'Sedang Dikerjakan', variant: 'info', icon: Hammer, stage: 2 };
  if (b.status === 'CONFIRMED' || isPaid(b)) return { label: 'Dikonfirmasi · Aktif', variant: 'success', icon: CheckCircle2, stage: 2 };
  return { label: 'Menunggu Pembayaran DP', variant: 'warning', icon: Clock, stage: 0 };
}

function needsPayment(b: CustomerBooking): boolean {
  return b.status === 'PENDING' && !isPaid(b);
}

function canComplete(b: CustomerBooking): boolean {
  return (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') && isPaid(b) && b.reviewRating == null;
}

// ─── Payment countdown (auto-cancel TTL = 60 min from createdAt) ──────────────
const PAY_TTL_MS = 60 * 60 * 1000;

function useCountdown(deadline: number): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, deadline - now);
}

function PayCountdown({ createdAt }: { createdAt: string }) {
  const deadline = new Date(createdAt).getTime() + PAY_TTL_MS;
  const remaining = useCountdown(deadline);
  // The countdown is time-dependent, so it would mismatch between SSR and the
  // first client render. Show a static hint until mounted, then tick live.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <Clock className="h-3.5 w-3.5" />
        Selesaikan sebelum batas waktu pembayaran
      </span>
    );
  }
  if (remaining <= 0) {
    return <span className="text-xs font-medium text-red-600">Batas waktu pembayaran telah lewat.</span>;
  }
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
      <Clock className="h-3.5 w-3.5" />
      Selesaikan dalam {mm}:{ss.toString().padStart(2, '0')}
    </span>
  );
}

// ─── Progress stepper ─────────────────────────────────────────────────────────
const STEPS = ['Dibuat', 'DP Dibayar', 'Dikonfirmasi', 'Selesai'];

function Stepper({ stage }: { stage: number }) {
  return (
    <ol className="flex items-center">
      {STEPS.map((label, i) => {
        const done = stage >= i;
        const active = stage === i;
        return (
          <React.Fragment key={label}>
            <li className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors',
                  done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  active && 'ring-4 ring-primary/15'
                )}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[10px] font-medium sm:text-xs',
                  done ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </li>
            {i < STEPS.length - 1 && (
              <span className={cn('mx-1 mb-5 h-0.5 flex-1 rounded', stage > i ? 'bg-primary' : 'bg-border')} />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type TabKey = 'all' | 'pending' | 'active' | 'completed' | 'cancelled';
const TABS: { key: TabKey; label: string; match: (b: CustomerBooking) => boolean }[] = [
  { key: 'all', label: 'Semua', match: () => true },
  { key: 'pending', label: 'Menunggu Pembayaran', match: needsPayment },
  { key: 'active', label: 'Aktif', match: (b) => isPaid(b) && (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') },
  { key: 'completed', label: 'Selesai', match: (b) => b.status === 'COMPLETED' },
  { key: 'cancelled', label: 'Dibatalkan', match: (b) => b.status === 'CANCELLED' },
];

export function CustomerBookings({ bookings }: { bookings: CustomerBooking[] }) {
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = React.useState<TabKey>('all');

  // Rating + completion modal state
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // Payment confirmation modal state
  const [payTarget, setPayTarget] = React.useState<CustomerBooking | null>(null);
  const [paying, setPaying] = React.useState(false);

  function openRating(id: string) {
    setActiveId(id);
    setRating(5);
    setComment('');
  }

  async function confirmComplete() {
    if (!activeId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${activeId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error('Gagal menyelesaikan', json.message ?? 'Silakan coba lagi.');
        return;
      }
      toast.success('Pekerjaan selesai!', 'Dana telah dicairkan ke tukang.');
      setActiveId(null);
      router.refresh();
    } catch {
      toast.error('Koneksi bermasalah', 'Tidak dapat terhubung ke server.');
    } finally {
      setSubmitting(false);
    }
  }

  function startSnapPayment(snapToken: string) {
    if (typeof window === 'undefined' || !window.snap) {
      toast.error('Pembayaran belum siap', 'Muat ulang halaman lalu coba lagi.');
      return;
    }
    window.snap.pay(snapToken, {
      onSuccess: () => {
        toast.success('Pembayaran berhasil!', 'Menunggu konfirmasi tukang.');
        router.refresh();
      },
      onPending: () => {
        toast.info('Pembayaran pending', 'Selesaikan sesuai instruksi pembayaran.');
        router.refresh();
      },
      onError: () => toast.error('Pembayaran gagal', 'Silakan coba lagi.'),
      onClose: () => toast.info('Pembayaran belum selesai', 'Lanjutkan kapan saja dari dashboard.'),
    });
  }

  async function confirmPayment() {
    if (!payTarget) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/bookings/${payTarget.id}/pay`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error('Tidak bisa membayar', json.message ?? 'Silakan coba lagi.');
        return;
      }
      setPayTarget(null);
      // Dev / no-Midtrans fallback: a mock token means there's no real Snap popup.
      if (json.data.mock) {
        toast.success('Pembayaran disimulasikan (demo)', 'Booking dikonfirmasi.');
        router.refresh();
        return;
      }
      startSnapPayment(json.data.snapToken);
    } catch {
      toast.error('Koneksi bermasalah', 'Tidak dapat terhubung ke server.');
    } finally {
      setPaying(false);
    }
  }

  const counts = React.useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, bookings.filter(t.match).length])) as Record<TabKey, number>,
    [bookings]
  );
  const visible = bookings.filter(TABS.find((t) => t.key === tab)!.match);

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center animate-fade-in">
        <TukangIllustration className="h-32 w-32" />
        <h3 className="mt-4 text-lg font-bold text-foreground">Belum ada booking aktif</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Mulai cari tukang terpercaya di sekitarmu dan amankan jadwalnya.
        </p>
        <Link
          href="/search"
          className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'mt-6')}
        >
          Cari Tukang →
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Status tabs */}
      <div className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            {t.label}
            <span
              className={cn(
                'rounded-full px-1.5 text-xs font-bold',
                tab === t.key ? 'bg-white/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-7 w-7" />}
          title="Tidak ada booking di kategori ini"
          description="Coba pilih tab lain untuk melihat booking Anda."
        />
      ) : (
        <div className="grid gap-4">
          {visible.map((b) => {
            const meta = deriveStatus(b);
            const remaining = Math.max(0, b.totalFee - b.dpAmount);
            const StatusIcon = meta.icon;
            return (
              <div key={b.id} className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground">{b.providerName}</h3>
                      <Badge variant="primary">{b.category}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Booking #{b.id.slice(-6).toUpperCase()}</p>
                  </div>
                  <Badge variant={meta.variant}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {meta.label}
                  </Badge>
                </div>

                {b.description && <p className="mt-3 text-sm text-muted-foreground">{b.description}</p>}

                <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {b.address}
                    {b.district ? `, ${b.district}` : ''}
                  </span>
                  {b.scheduledDate && (
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      {formatBookingDate(b.scheduledDate)}
                      {b.timeSlot ? ` · ${timeSlotStart(b.timeSlot)}` : ''}
                    </span>
                  )}
                </div>

                {/* Progress stepper (hidden for cancelled) */}
                {meta.stage >= 0 && (
                  <div className="mt-5 rounded-xl bg-muted/40 px-4 py-4">
                    <Stepper stage={meta.stage} />
                  </div>
                )}

                {/* Cost breakdown */}
                <dl className="mt-4 space-y-1.5 rounded-xl border border-border p-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total Biaya</dt>
                    <dd className="font-semibold text-foreground">{formatCurrency(b.totalFee)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{isPaid(b) ? 'DP Dibayar' : 'DP yang harus dibayar'}</dt>
                    <dd className="font-semibold text-foreground">{formatCurrency(b.dpAmount)}</dd>
                  </div>
                  {b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && (
                    <div className="flex justify-between border-t border-dashed border-border pt-1.5">
                      <dt className="text-muted-foreground" title="Sisa dibayar setelah pekerjaan selesai">
                        Sisa pelunasan
                      </dt>
                      <dd className="font-semibold text-foreground">{formatCurrency(remaining)}</dd>
                    </div>
                  )}
                </dl>

                {/* CTA / actions */}
                {needsPayment(b) && (
                  <div className="mt-4">
                    <Button size="lg" className="w-full" onClick={() => setPayTarget(b)}>
                      <CreditCard className="h-4.5 w-4.5" />
                      Bayar DP Sekarang — {formatCurrency(b.dpAmount)}
                    </Button>
                    <div className="mt-2 flex justify-center">
                      <PayCountdown createdAt={b.createdAt} />
                    </div>
                  </div>
                )}

                {(isPaid(b) || b.status === 'COMPLETED') && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                    {canComplete(b) && (
                      <Button size="sm" onClick={() => openRating(b.id)}>
                        Pekerjaan Selesai
                      </Button>
                    )}
                    <Link
                      href={`/booking/${b.id}/receipt`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      <Receipt className="h-4 w-4" />
                      Lihat Nota
                    </Link>
                    {b.reviewRating != null && (
                      <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-amber-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn('h-4 w-4', i < b.reviewRating! ? 'fill-amber-400 text-amber-400' : 'text-slate-300')}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Payment confirmation modal */}
      <Modal
        open={!!payTarget}
        onClose={() => !paying && setPayTarget(null)}
        title="Konfirmasi Pembayaran DP"
        description="Periksa detail booking sebelum lanjut ke pembayaran."
      >
        {payTarget && (
          <>
            <dl className="space-y-2.5 rounded-xl bg-muted/40 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Tukang</dt>
                <dd className="text-right font-semibold text-foreground">{payTarget.providerName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Layanan</dt>
                <dd className="text-right font-semibold text-foreground">{payTarget.category}</dd>
              </div>
              {payTarget.scheduledDate && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Tanggal</dt>
                  <dd className="text-right font-semibold text-foreground">
                    {formatBookingDate(payTarget.scheduledDate)}
                    {payTarget.timeSlot ? ` · ${timeSlotStart(payTarget.timeSlot)}` : ''}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Lokasi</dt>
                <dd className="text-right font-semibold text-foreground">
                  {payTarget.address}
                  {payTarget.district ? `, ${payTarget.district}` : ''}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-primary/30 bg-primary-light/60 px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Jumlah DP</span>
              <span className="text-lg font-extrabold text-primary">{formatCurrency(payTarget.dpAmount)}</span>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" size="md" disabled={paying} onClick={() => setPayTarget(null)}>
                Batal
              </Button>
              <Button size="md" loading={paying} onClick={confirmPayment}>
                {paying ? 'Memproses...' : 'Lanjut ke Pembayaran →'}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Rating + completion modal */}
      <Modal open={!!activeId} onClose={() => !submitting && setActiveId(null)}>
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-center text-xl font-bold tracking-tight text-foreground">Selesaikan & Beri Rating</h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">Beri penilaian untuk pekerjaan tukang.</p>

        <div className="mt-5 flex justify-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => {
            const value = i + 1;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value} bintang`}
                className="transition-transform hover:scale-110"
              >
                <Star className={cn('h-9 w-9', value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
              </button>
            );
          })}
        </div>

        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Komentar (opsional)..."
          className="mt-4"
        />

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Dana akan langsung dicairkan ke tukang setelah kamu konfirmasi. Tindakan ini tidak bisa dibatalkan.
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Button size="lg" loading={submitting} onClick={confirmComplete}>
            {submitting ? 'Memproses...' : 'Konfirmasi Selesai & Cairkan Dana'}
          </Button>
          <Button variant="ghost" size="md" disabled={submitting} onClick={() => setActiveId(null)}>
            Batal
          </Button>
        </div>
      </Modal>
    </>
  );
}
