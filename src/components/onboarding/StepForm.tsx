'use client';

import * as React from 'react';
import { produce } from 'immer';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  IdCard,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { useSession } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import {
  kycOnboardingSchema,
  kycStepSchemas,
  fieldErrors,
  PROVIDER_CATEGORIES,
  DISTRICTS,
} from '@/lib/validations';
import { StepIndicator } from './StepIndicator';

const STEPS = ['Data Diri', 'Keahlian', 'Lokasi', 'Review'] as const;
const MAX_DISTRICTS = 5;
const MAX_CATEGORIES = 5;

interface Data {
  name: string;
  nik: string;
  categories: string[];
  experienceYears: number;
  dailyRate: number;
  districts: string[];
  serviceRadiusKm: number;
}

interface State {
  step: number;
  data: Data;
  errors: Record<string, string>;
  consent: boolean;
  submitting: boolean;
}

const initialState: State = {
  step: 0,
  data: {
    name: '',
    nik: '',
    categories: [],
    experienceYears: 0,
    dailyRate: 150_000,
    districts: [],
    serviceRadiusKm: 10,
  },
  errors: {},
  consent: false,
  submitting: false,
};

type Action =
  | { type: 'PATCH'; patch: Partial<Data>; clearKeys?: string[] }
  | { type: 'TOGGLE_IN_ARRAY'; key: 'categories' | 'districts'; value: string; max: number }
  | { type: 'SET_ERRORS'; errors: Record<string, string> }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'SET_CONSENT'; value: boolean }
  | { type: 'SET_SUBMITTING'; value: boolean };

const reducer = (state: State, action: Action): State =>
  produce(state, (draft) => {
    switch (action.type) {
      case 'PATCH':
        Object.assign(draft.data, action.patch);
        action.clearKeys?.forEach((k) => delete draft.errors[k]);
        break;
      case 'TOGGLE_IN_ARRAY': {
        const arr = draft.data[action.key];
        const idx = arr.indexOf(action.value);
        if (idx >= 0) arr.splice(idx, 1);
        else if (arr.length < action.max) arr.push(action.value);
        delete draft.errors[action.key];
        break;
      }
      case 'SET_ERRORS':
        draft.errors = action.errors;
        break;
      case 'NEXT':
        draft.step = Math.min(draft.step + 1, STEPS.length - 1);
        draft.errors = {};
        break;
      case 'BACK':
        draft.step = Math.max(draft.step - 1, 0);
        draft.errors = {};
        break;
      case 'SET_CONSENT':
        draft.consent = action.value;
        break;
      case 'SET_SUBMITTING':
        draft.submitting = action.value;
        break;
    }
  });

function toParseInput(d: Data) {
  return { ...d };
}

export default function StepForm() {
  const router = useRouter();
  const toast = useToast();
  const { data: session, status, update: refreshSession } = useSession();
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const [done, setDone] = React.useState(false);

  const { step, data, errors } = state;

  React.useEffect(() => {
    const n = session?.user?.name;
    if (n && !data.name && n !== session?.user?.phone) {
      dispatch({ type: 'PATCH', patch: { name: n } });
    }
  }, [session, data.name]);

  function validateStep(target: number): boolean {
    const schema = kycStepSchemas[target];
    if (!schema) return true;
    const parsed = schema.safeParse(toParseInput(data));
    if (!parsed.success) {
      dispatch({ type: 'SET_ERRORS', errors: fieldErrors(parsed.error) });
      toast.error('Periksa kembali isian Anda', 'Beberapa kolom belum benar.');
      return false;
    }
    return true;
  }

  function next() {
    if (validateStep(step)) dispatch({ type: 'NEXT' });
  }

  async function handleSubmit() {
    const parsed = kycOnboardingSchema.safeParse(toParseInput(data));
    if (!parsed.success) {
      dispatch({ type: 'SET_ERRORS', errors: fieldErrors(parsed.error) });
      toast.error('Data belum lengkap', 'Periksa kembali langkah sebelumnya.');
      return;
    }

    dispatch({ type: 'SET_SUBMITTING', value: true });
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        if (json.errors) dispatch({ type: 'SET_ERRORS', errors: json.errors });
        toast.error('Pendaftaran gagal', json.message ?? 'Silakan coba lagi.');
        return;
      }
      await refreshSession();
      setDone(true);
    } catch {
      toast.error('Koneksi bermasalah', 'Tidak dapat terhubung ke server.');
    } finally {
      dispatch({ type: 'SET_SUBMITTING', value: false });
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const isLast = step === STEPS.length - 1;

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <StepIndicator steps={[...STEPS]} current={step} />

        <div className="mt-8 space-y-5">
          {step === 0 && (
            <>
              <div className="rounded-xl border border-primary/20 bg-primary-light/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary">
                    <LockKeyhole className="h-4.5 w-4.5" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Gegarap tidak menyimpan foto KTP untuk mengurangi risiko penyalahgunaan data.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      NIK digunakan untuk proses verifikasi internal dan tidak akan ditampilkan ke
                      pelanggan.
                    </p>
                  </div>
                </div>
              </div>

              <Field label="Nama Lengkap" htmlFor="provider-name" required error={errors.name}>
                <Input
                  id="provider-name"
                  value={data.name}
                  onChange={(e) =>
                    dispatch({ type: 'PATCH', patch: { name: e.target.value }, clearKeys: ['name'] })
                  }
                  placeholder="Budi Santoso"
                  invalid={!!errors.name}
                />
              </Field>

              <Field
                label="NIK"
                htmlFor="provider-nik"
                required
                error={errors.nik}
                hint="Masukkan 16 digit angka tanpa spasi."
              >
                <Input
                  id="provider-nik"
                  value={data.nik}
                  inputMode="numeric"
                  maxLength={16}
                  leftIcon={<IdCard className="h-4 w-4" />}
                  onChange={(e) =>
                    dispatch({
                      type: 'PATCH',
                      patch: { nik: e.target.value.replace(/[^0-9]/g, '').slice(0, 16) },
                      clearKeys: ['nik'],
                    })
                  }
                  placeholder="3404xxxxxxxxxxxx"
                  invalid={!!errors.nik}
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field
                label="Kategori Jasa"
                required
                error={errors.categories}
                hint={`Pilih keahlian Anda (maks ${MAX_CATEGORIES}).`}
              >
                <ChipGroup
                  options={[...PROVIDER_CATEGORIES]}
                  selected={data.categories}
                  onToggle={(value) =>
                    dispatch({ type: 'TOGGLE_IN_ARRAY', key: 'categories', value, max: MAX_CATEGORIES })
                  }
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Pengalaman (tahun)" required error={errors.experienceYears}>
                  <Input
                    id="provider-experience"
                    type="number"
                    min={0}
                    max={60}
                    value={data.experienceYears}
                    onChange={(e) =>
                      dispatch({
                        type: 'PATCH',
                        patch: { experienceYears: Number(e.target.value) || 0 },
                        clearKeys: ['experienceYears'],
                      })
                    }
                    invalid={!!errors.experienceYears}
                  />
                </Field>
                <Field
                  label="Tarif Harian (Rp)"
                  htmlFor="provider-daily-rate"
                  required
                  error={errors.dailyRate}
                  hint="Wajib agar profil bisa dibooking."
                >
                  <Input
                    id="provider-daily-rate"
                    type="number"
                    min={50000}
                    step={10000}
                    value={data.dailyRate}
                    onChange={(e) =>
                      dispatch({
                        type: 'PATCH',
                        patch: { dailyRate: Number(e.target.value) || 0 },
                        clearKeys: ['dailyRate'],
                      })
                    }
                    invalid={!!errors.dailyRate}
                  />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Field
                label="Kecamatan Operasional"
                required
                error={errors.districts}
                hint={`Pilih area kerja Anda (maks ${MAX_DISTRICTS}).`}
              >
                <ChipGroup
                  options={[...DISTRICTS]}
                  selected={data.districts}
                  onToggle={(value) =>
                    dispatch({ type: 'TOGGLE_IN_ARRAY', key: 'districts', value, max: MAX_DISTRICTS })
                  }
                />
              </Field>
              <Field
                label="Radius Layanan (km)"
                htmlFor="provider-service-radius"
                required
                error={errors.serviceRadiusKm}
                hint="Seberapa jauh Anda bersedia menerima pekerjaan."
              >
                <Input
                  id="provider-service-radius"
                  type="number"
                  min={1}
                  max={50}
                  value={data.serviceRadiusKm}
                  onChange={(e) =>
                    dispatch({
                      type: 'PATCH',
                      patch: { serviceRadiusKm: Number(e.target.value) || 0 },
                      clearKeys: ['serviceRadiusKm'],
                    })
                  }
                  invalid={!!errors.serviceRadiusKm}
                />
              </Field>
            </>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Tinjau data Anda</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Setelah dikirim, status identitas Anda menjadi Identitas diajukan sampai admin
                  meninjau data.
                </p>
              </div>
              <dl className="divide-y divide-border rounded-xl border border-border">
                <Row label="Nama" value={data.name} />
                <Row label="NIK" value={maskNik(data.nik)} />
                <Row label="Keahlian" value={data.categories.join(', ') || '-'} />
                <Row label="Pengalaman" value={`${data.experienceYears} tahun`} />
                <Row label="Tarif harian" value={`Rp ${data.dailyRate.toLocaleString('id-ID')}`} />
                <Row label="Kecamatan" value={data.districts.join(', ') || '-'} />
                <Row label="Radius layanan" value={`${data.serviceRadiusKm} km`} />
              </dl>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <input
                  type="checkbox"
                  checked={state.consent}
                  onChange={(e) => dispatch({ type: 'SET_CONSENT', value: e.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-sm text-foreground">
                  Saya menyatakan data di atas benar dan menyetujui proses verifikasi internal
                  gegarap.id.
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => dispatch({ type: 'BACK' })}
            disabled={step === 0 || state.submitting}
          >
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>

          {isLast ? (
            <Button
              type="button"
              variant="dark"
              loading={state.submitting}
              disabled={!state.consent}
              onClick={handleSubmit}
            >
              <ShieldCheck className="h-4 w-4" />
              {state.submitting ? 'Mengirim...' : 'Kirim untuk Verifikasi'}
            </Button>
          ) : (
            <Button type="button" onClick={next}>
              Lanjut <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Modal
        open={done}
        onClose={() => router.push('/provider/dashboard')}
        className="text-center"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
          <CheckCircle2 className="h-9 w-9 text-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Profil Terkirim</h2>
        <p className="mt-2 text-muted-foreground">
          Terima kasih, <span className="font-semibold text-foreground">{data.name || 'Mitra'}</span>.
          Tim kami akan meninjau verifikasi identitas Anda.
        </p>
        <Button size="lg" className="mt-6 w-full" onClick={() => router.push('/provider/dashboard')}>
          Lihat Dashboard
        </Button>
      </Modal>
    </>
  );
}

function maskNik(nik: string): string {
  if (nik.length < 16) return nik || '-';
  return `************${nik.slice(-4)}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(o)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all',
              active
                ? 'border-primary bg-primary text-primary-foreground shadow-soft'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
