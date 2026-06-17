'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ShieldCheck, User as UserIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Avatar';
import { Rating } from '@/components/ui/Rating';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { calculateBookingFinancials, type FeeRule } from '@/lib/calculations';
import { formatCurrency } from '@/lib/utils';
import { bookingSchema, fieldErrors, DISTRICTS, TIME_SLOTS } from '@/lib/validations';

interface BookingFormProps {
  provider: {
    id: string;
    name: string;
    category: string;
    dailyRate: number;
    rating: number;
    ratingCount: number;
  };
  /** Resolved fee rule (percent-based DP & platform fee) for this category. */
  feeRule: FeeRule;
}

const TIME_SLOT_LABELS: Record<string, string> = {
  pagi: 'Pagi (08.00–11.00)',
  siang: 'Siang (11.00–15.00)',
  sore: 'Sore (15.00–18.00)',
};

/** Today's date as yyyy-mm-dd for the date input min/default. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingForm({ provider, feeRule }: BookingFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { data: session, status } = useSession();

  const [form, setForm] = React.useState({
    description: '',
    customerAddress: '',
    district: DISTRICTS[0] as string,
    scheduledDate: todayISO(),
    timeSlot: TIME_SLOTS[0] as string,
    estimatedDays: 1,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  // /book is middleware-guarded, but guard on the client too for safety.
  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?redirect=' + encodeURIComponent(pathname));
    }
  }, [status, router, pathname]);

  // DP & platform fee are percent-based (config-driven) — the customer no longer
  // types a DP; we show exactly what the server will charge.
  const fin = calculateBookingFinancials(provider.dailyRate, form.estimatedDays || 1, feeRule);

  const update = (key: keyof typeof form, value: string | number) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: '' } : e));
  };

  function startSnapPayment(snapToken: string) {
    if (typeof window === 'undefined' || !window.snap) {
      toast.error('Pembayaran belum siap', 'Muat ulang halaman lalu coba lagi.');
      return;
    }
    window.snap.pay(snapToken, {
      onSuccess: () => {
        toast.success('Pembayaran berhasil!', 'Menunggu konfirmasi tukang.');
        router.push('/dashboard');
      },
      onPending: () => {
        toast.info('Pembayaran pending', 'Selesaikan sesuai instruksi pembayaran.');
        router.push('/dashboard');
      },
      onError: () => toast.error('Pembayaran gagal', 'Silakan coba lagi.'),
      onClose: () =>
        toast.info('Pembayaran dibatalkan', 'Booking tersimpan, selesaikan dari dashboard.'),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = { ...form, providerProfileId: provider.id };
    const parsed = bookingSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      toast.error('Periksa kembali isian Anda', 'Beberapa kolom belum benar.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        if (json.errors) setErrors(json.errors);
        toast.error('Booking gagal', json.message ?? 'Silakan coba lagi.');
        return;
      }

      // Dev / no-Midtrans fallback: skip the Snap popup.
      if (json.data.mockPayment) {
        toast.success('Booking dibuat (mode demo)', 'Pembayaran disimulasikan.');
        router.push('/dashboard');
        return;
      }

      startSnapPayment(json.data.snapToken);
    } catch {
      toast.error('Koneksi bermasalah', 'Tidak dapat terhubung ke server.');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const bookingName = session?.user?.name ?? session?.user?.phone ?? 'Akun Anda';

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-5">
      {/* Form fields */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8 lg:col-span-3">
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-muted/40 p-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">
            <UserIcon className="h-4 w-4" />
          </span>
          <div className="text-sm">
            <p className="text-muted-foreground">Booking atas nama</p>
            <p className="font-semibold text-foreground">{bookingName}</p>
          </div>
        </div>

        <div className="space-y-5">
          <Field label="Deskripsi Pekerjaan" required error={errors.description}>
            <Textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
              placeholder="Contoh: keran dapur bocor dan saluran air mampet."
              invalid={!!errors.description}
            />
          </Field>

          <Field label="Alamat Lengkap (DIY)" required error={errors.customerAddress}>
            <Textarea
              value={form.customerAddress}
              onChange={(e) => update('customerAddress', e.target.value)}
              rows={2}
              placeholder="Jl. Kaliurang KM 5, Sleman, Yogyakarta..."
              invalid={!!errors.customerAddress}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Kecamatan" required error={errors.district}>
              <Select
                value={form.district}
                onChange={(e) => update('district', e.target.value)}
                invalid={!!errors.district}
              >
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Estimasi Hari Kerja" required error={errors.estimatedDays}>
              <Input
                type="number"
                min={1}
                max={30}
                value={form.estimatedDays}
                onChange={(e) =>
                  update('estimatedDays', Math.max(1, Math.min(30, Number(e.target.value) || 1)))
                }
                invalid={!!errors.estimatedDays}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Tanggal Mulai" required error={errors.scheduledDate}>
              <Input
                type="date"
                min={todayISO()}
                value={form.scheduledDate}
                onChange={(e) => update('scheduledDate', e.target.value)}
                invalid={!!errors.scheduledDate}
              />
            </Field>
            <Field label="Waktu Pengerjaan" required error={errors.timeSlot}>
              <Select
                value={form.timeSlot}
                onChange={(e) => update('timeSlot', e.target.value)}
                invalid={!!errors.timeSlot}
              >
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {TIME_SLOT_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </div>

      {/* Summary (sticky on desktop) */}
      <div className="lg:col-span-2">
        <div className="space-y-5 lg:sticky lg:top-24">
          {/* Provider mini-card */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <Avatar name={provider.name} size="md" />
              <div className="min-w-0">
                <p className="truncate font-bold text-foreground">{provider.name}</p>
                <Badge variant="primary" className="mt-1">
                  {provider.category}
                </Badge>
              </div>
            </div>
            <div className="mt-3">
              <Rating value={provider.rating} count={provider.ratingCount} />
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="font-bold text-foreground">Rincian Biaya</h3>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Tarif harian</dt>
                <dd>{formatCurrency(provider.dailyRate)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Total jasa ({form.estimatedDays || 1} hari)</dt>
                <dd>{formatCurrency(fin.subtotal)}</dd>
              </div>
            </dl>

            <div className="my-4 border-t border-border" />

            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="font-semibold text-foreground">
                  DP dibayar sekarang ({fin.dpPercentApplied}%)
                </dt>
                <dd className="font-bold text-primary">{formatCurrency(fin.dpAmount)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>Sisa setelah selesai</dt>
                <dd>{formatCurrency(fin.remainingAmount)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              DP mengamankan jadwal dengan tukang. Sisa pembayaran ditagih setelah pekerjaan
              dikonfirmasi selesai, dan dana ditahan aman oleh sistem hingga selesai.
            </p>

            <Button type="submit" size="lg" loading={submitting} className="mt-5 w-full">
              {submitting ? 'Memproses...' : `Bayar DP ${formatCurrency(fin.dpAmount)}`}
            </Button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Pembayaran aman via Midtrans
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
