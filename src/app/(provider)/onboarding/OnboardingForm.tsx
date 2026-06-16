'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { UploadCloud, CheckCircle2, Wallet, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import {
  onboardingSchema,
  fieldErrors,
  PROVIDER_CATEGORIES,
  DISTRICTS,
} from '@/lib/validations';

const MAX_DISTRICTS = 5;

export default function OnboardingForm() {
  const router = useRouter();
  const toast = useToast();
  const { data: session, status, update: refreshSession } = useSession();

  const [form, setForm] = React.useState({
    name: '',
    category: PROVIDER_CATEGORIES[0] as string,
    dailyRate: 150000,
    goPayNumber: '',
    bio: '',
  });
  const [districts, setDistricts] = React.useState<string[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  // KTP upload state.
  const [ktpPreview, setKtpPreview] = React.useState<string | null>(null);
  const [ktpUrl, setKtpUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  // Prefill the display name from the session once available.
  React.useEffect(() => {
    if (session?.user?.name && !form.name) {
      const n = session.user.name;
      // Skip the synthetic "name == phone" placeholder.
      if (n !== session.user.phone) setForm((f) => ({ ...f, name: n! }));
    }
  }, [session, form.name]);

  const update = (key: keyof typeof form, value: string | number) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: '' } : e));
  };

  const toggleDistrict = (d: string) => {
    setErrors((e) => (e.districts ? { ...e, districts: '' } : e));
    setDistricts((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d);
      if (prev.length >= MAX_DISTRICTS) {
        toast.error('Maksimal 5 kecamatan', 'Hapus salah satu untuk menambah yang lain.');
        return prev;
      }
      return [...prev, d];
    });
  };

  async function handleKtpChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setKtpPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('ktp', file);
      const res = await fetch('/api/upload/ktp', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.ok) {
        setKtpUrl(data.url);
        toast.success('KTP berhasil diupload');
      } else {
        toast.error('Upload KTP gagal', data.message ?? 'Coba lagi.');
        setKtpPreview(null);
      }
    } catch {
      toast.error('Koneksi bermasalah', 'Tidak dapat mengunggah KTP.');
      setKtpPreview(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = { ...form, districts, ktpImageUrl: ktpUrl ?? undefined };
    const parsed = onboardingSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      toast.error('Periksa kembali isian Anda', 'Beberapa kolom belum benar.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        if (json.errors) setErrors(json.errors);
        toast.error('Pendaftaran gagal', json.message ?? 'Silakan coba lagi.');
        return;
      }
      // Refresh the session so the JWT role becomes PROVIDER immediately (the
      // jwt callback re-reads role from the DB on update) — this lets the
      // /provider area and "Dashboard Tukang" menu unlock without a re-login.
      await refreshSession();
      setDone(true);
      toast.success('Profil terkirim!', 'Tim kami akan meninjau verifikasi Anda.');
    } catch {
      toast.error('Koneksi bermasalah', 'Tidak dapat terhubung ke server.');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8"
      >
        <div className="space-y-5">
          <Field label="Nama Lengkap" required error={errors.name}>
            <Input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Budi Santoso"
              invalid={!!errors.name}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Kategori Keahlian" required error={errors.category}>
              <Select
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                invalid={!!errors.category}
              >
                {PROVIDER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tarif Harian (Rp)" required error={errors.dailyRate}>
              <Input
                type="number"
                min={50000}
                step={10000}
                value={form.dailyRate}
                onChange={(e) => update('dailyRate', Number(e.target.value) || 0)}
                invalid={!!errors.dailyRate}
              />
            </Field>
          </div>

          <Field
            label="Kecamatan Operasional"
            required
            error={errors.districts}
            hint={`Pilih area kerja Anda (maks ${MAX_DISTRICTS}).`}
          >
            <div className="flex flex-wrap gap-2">
              {DISTRICTS.map((d) => {
                const active = districts.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDistrict(d)}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all',
                      active
                        ? 'border-primary bg-primary text-primary-foreground shadow-soft'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Nomor GoPay (Pencairan)" required error={errors.goPayNumber}>
            <Input
              value={form.goPayNumber}
              onChange={(e) => update('goPayNumber', e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="08123456789"
              inputMode="numeric"
              leftIcon={<Wallet className="h-4 w-4" />}
              invalid={!!errors.goPayNumber}
            />
          </Field>

          <Field
            label="Deskripsi Singkat"
            error={errors.bio}
            hint="Ceritakan pengalaman & keahlian Anda (opsional)."
          >
            <Textarea
              value={form.bio}
              onChange={(e) => update('bio', e.target.value)}
              rows={3}
              placeholder="Spesialis instalasi pipa air dengan 8 tahun pengalaman..."
              invalid={!!errors.bio}
            />
          </Field>

          <Field
            label="Upload KTP (KYC)"
            required
            hint="Untuk verifikasi identitas — wajib sebelum profil aktif."
          >
            {ktpPreview ? (
              <div className="relative overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ktpPreview}
                  alt="Preview KTP"
                  className="mx-auto max-h-48 w-full object-contain bg-muted/30"
                />
                <button
                  type="button"
                  onClick={() => {
                    setKtpPreview(null);
                    setKtpUrl(null);
                  }}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 text-white transition-colors hover:bg-slate-900"
                  aria-label="Ganti foto KTP"
                >
                  <X className="h-4 w-4" />
                </button>
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-card/70">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-8 text-center transition-colors hover:border-primary/40 hover:bg-muted/50">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleKtpChange}
                  className="hidden"
                />
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                  <UploadCloud className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium text-foreground">Klik untuk upload foto KTP</span>
                <span className="text-xs text-muted-foreground">PNG, JPG hingga 5MB</span>
              </label>
            )}
          </Field>

          <Button
            type="submit"
            size="lg"
            variant="dark"
            loading={submitting}
            disabled={!ktpUrl || uploading}
            className="w-full"
          >
            {submitting ? 'Mengirim...' : 'Kirim Profil untuk Verifikasi'}
          </Button>
          {!ktpUrl && (
            <p className="text-center text-xs text-muted-foreground">
              Upload KTP terlebih dahulu untuk mengaktifkan tombol.
            </p>
          )}
        </div>
      </form>

      <Modal
        open={done}
        onClose={() => {
          setDone(false);
          router.push('/provider/dashboard');
        }}
        className="text-center"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
          <CheckCircle2 className="h-9 w-9 text-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Profil Terkirim! 🎉</h2>
        <p className="mt-2 text-muted-foreground">
          Terima kasih, <span className="font-semibold text-foreground">{form.name || 'Mitra'}</span>
          . Tim kami akan meninjau data Anda dalam 1–2 hari kerja.
        </p>
        <Button
          size="lg"
          className="mt-6 w-full"
          onClick={() => {
            setDone(false);
            router.push('/provider/dashboard');
          }}
        >
          Lihat Dashboard
        </Button>
      </Modal>
    </>
  );
}
