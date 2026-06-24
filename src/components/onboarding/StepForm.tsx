'use client';

import * as React from 'react';
import { produce } from 'immer';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  Loader2,
  X,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
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

const STEPS = ['Data Diri', 'Keahlian', 'Lokasi', 'Dokumen', 'Review'] as const;
const MAX_DISTRICTS = 5;
const MAX_CATEGORIES = 5;

type DocKind = 'ktp' | 'face' | 'certificate';

interface Data {
  name: string;
  nik: string;
  ktpImageUrl: string;
  categories: string[];
  experienceYears: number;
  dailyRate: number;
  districts: string[];
  serviceRadiusKm: number;
  faceImageUrl: string;
  certificateUrl: string;
}

interface State {
  step: number;
  data: Data;
  previews: Partial<Record<DocKind, string>>;
  uploading: Partial<Record<DocKind, boolean>>;
  errors: Record<string, string>;
  consent: boolean;
  submitting: boolean;
}

type DocField = 'ktpImageUrl' | 'faceImageUrl' | 'certificateUrl';
const DOC_FIELD: Record<DocKind, DocField> = {
  ktp: 'ktpImageUrl',
  face: 'faceImageUrl',
  certificate: 'certificateUrl',
};

const initialState: State = {
  step: 0,
  data: {
    name: '',
    nik: '',
    ktpImageUrl: '',
    categories: [],
    experienceYears: 0,
    dailyRate: 150_000,
    districts: [],
    serviceRadiusKm: 10,
    faceImageUrl: '',
    certificateUrl: '',
  },
  previews: {},
  uploading: {},
  errors: {},
  consent: false,
  submitting: false,
};

type Action =
  | { type: 'PATCH'; patch: Partial<Data>; clearKeys?: string[] }
  | { type: 'TOGGLE_IN_ARRAY'; key: 'categories' | 'districts'; value: string; max: number }
  | { type: 'SET_PREVIEW'; kind: DocKind; url: string | null }
  | { type: 'SET_UPLOADING'; kind: DocKind; value: boolean }
  | { type: 'SET_DOC'; kind: DocKind; path: string }
  | { type: 'CLEAR_DOC'; kind: DocKind }
  | { type: 'SET_ERRORS'; errors: Record<string, string> }
  | { type: 'CLEAR_ERROR'; key: string }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'SET_CONSENT'; value: boolean }
  | { type: 'SET_SUBMITTING'; value: boolean };

// useReducer + immer: every case mutates the draft; immer produces the next state.
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
      case 'SET_PREVIEW':
        if (action.url) draft.previews[action.kind] = action.url;
        else delete draft.previews[action.kind];
        break;
      case 'SET_UPLOADING':
        draft.uploading[action.kind] = action.value;
        break;
      case 'SET_DOC':
        draft.data[DOC_FIELD[action.kind]] = action.path;
        delete draft.errors[DOC_FIELD[action.kind] as string];
        break;
      case 'CLEAR_DOC':
        draft.data[DOC_FIELD[action.kind]] = '';
        delete draft.previews[action.kind];
        break;
      case 'SET_ERRORS':
        draft.errors = action.errors;
        break;
      case 'CLEAR_ERROR':
        delete draft.errors[action.key];
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

/** Map state → schema input (optional empty doc becomes undefined). */
function toParseInput(d: Data) {
  return { ...d, certificateUrl: d.certificateUrl || undefined };
}

export default function StepForm() {
  const router = useRouter();
  const toast = useToast();
  const { data: session, status, update: refreshSession } = useSession();
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const [done, setDone] = React.useState(false);

  const { step, data, errors } = state;

  // Prefill display name from the session once available.
  React.useEffect(() => {
    const n = session?.user?.name;
    if (n && !data.name && n !== session?.user?.phone) {
      dispatch({ type: 'PATCH', patch: { name: n } });
    }
  }, [session, data.name]);

  async function uploadDoc(kind: DocKind, file: File) {
    dispatch({ type: 'SET_PREVIEW', kind, url: URL.createObjectURL(file) });
    dispatch({ type: 'SET_UPLOADING', kind, value: true });
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (res.ok && json.ok) {
        dispatch({ type: 'SET_DOC', kind, path: json.url });
        toast.success('Dokumen terupload');
      } else {
        toast.error('Upload gagal', json.message ?? 'Coba lagi.');
        dispatch({ type: 'SET_PREVIEW', kind, url: null });
      }
    } catch {
      toast.error('Koneksi bermasalah', 'Tidak dapat mengunggah dokumen.');
      dispatch({ type: 'SET_PREVIEW', kind, url: null });
    } finally {
      dispatch({ type: 'SET_UPLOADING', kind, value: false });
    }
  }

  function validateStep(target: number): boolean {
    const schema = kycStepSchemas[target];
    if (!schema) return true; // step 5 (Review) has no field schema
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
      // Refresh the session so the role flips to PROVIDER without a re-login.
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
          {/* ── Step 1 · Data Diri ── */}
          {step === 0 && (
            <>
              <Field label="Nama Lengkap" required error={errors.name}>
                <Input
                  value={data.name}
                  onChange={(e) =>
                    dispatch({ type: 'PATCH', patch: { name: e.target.value }, clearKeys: ['name'] })
                  }
                  placeholder="Budi Santoso"
                  invalid={!!errors.name}
                />
              </Field>
              <Field label="NIK (16 digit)" required error={errors.nik}>
                <Input
                  value={data.nik}
                  inputMode="numeric"
                  maxLength={16}
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
              <UploadBox
                kind="ktp"
                label="Foto KTP"
                required
                hint="Untuk verifikasi identitas. PNG/JPG hingga 5MB."
                state={state}
                onPick={uploadDoc}
                onClear={() => dispatch({ type: 'CLEAR_DOC', kind: 'ktp' })}
                error={errors.ktpImageUrl}
              />
            </>
          )}

          {/* ── Step 2 · Keahlian ── */}
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
                  required
                  error={errors.dailyRate}
                  hint="Wajib agar profil bisa dibooking."
                >
                  <Input
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

          {/* ── Step 3 · Lokasi ── */}
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
                required
                error={errors.serviceRadiusKm}
                hint="Seberapa jauh Anda bersedia menerima pekerjaan."
              >
                <Input
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

          {/* ── Step 4 · Dokumen ── */}
          {step === 3 && (
            <>
              <UploadBox
                kind="face"
                label="Foto Wajah"
                required
                hint="Selfie jelas untuk verifikasi liveness. PNG/JPG hingga 5MB."
                state={state}
                onPick={uploadDoc}
                onClear={() => dispatch({ type: 'CLEAR_DOC', kind: 'face' })}
                error={errors.faceImageUrl}
              />
              <UploadBox
                kind="certificate"
                label="Sertifikat (opsional)"
                hint="Sertifikat keahlian jika ada. PNG/JPG/PDF hingga 5MB."
                accept="image/jpeg,image/png,application/pdf"
                state={state}
                onPick={uploadDoc}
                onClear={() => dispatch({ type: 'CLEAR_DOC', kind: 'certificate' })}
                error={errors.certificateUrl}
              />
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                Foto KTP sudah diunggah di langkah 1.
              </div>
            </>
          )}

          {/* ── Step 5 · Review & Kirim ── */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-foreground">Tinjau data Anda</h2>
              <dl className="divide-y divide-border rounded-xl border border-border">
                <Row label="Nama" value={data.name} />
                <Row label="NIK" value={maskNik(data.nik)} />
                <Row label="Keahlian" value={data.categories.join(', ') || '—'} />
                <Row label="Pengalaman" value={`${data.experienceYears} tahun`} />
                <Row label="Tarif harian" value={`Rp ${data.dailyRate.toLocaleString('id-ID')}`} />
                <Row label="Kecamatan" value={data.districts.join(', ') || '—'} />
                <Row label="Radius layanan" value={`${data.serviceRadiusKm} km`} />
                <Row label="Foto KTP" value={data.ktpImageUrl ? 'Terlampir' : '—'} />
                <Row label="Foto wajah" value={data.faceImageUrl ? 'Terlampir' : '—'} />
                <Row label="Sertifikat" value={data.certificateUrl ? 'Terlampir' : 'Tidak ada'} />
              </dl>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <input
                  type="checkbox"
                  checked={state.consent}
                  onChange={(e) => dispatch({ type: 'SET_CONSENT', value: e.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-sm text-foreground">
                  Saya menyatakan seluruh data di atas benar dan menyetujui{' '}
                  <span className="font-semibold">Syarat &amp; Ketentuan</span> serta proses
                  verifikasi KYC gegarap.id.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
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
              {state.submitting ? 'Mengirim…' : 'Kirim untuk Verifikasi'}
            </Button>
          ) : (
            <Button type="button" onClick={next} disabled={isStepBusy(state)}>
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
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Profil Terkirim! 🎉</h2>
        <p className="mt-2 text-muted-foreground">
          Terima kasih, <span className="font-semibold text-foreground">{data.name || 'Mitra'}</span>.
          Tim kami akan meninjau verifikasi KYC Anda dalam 1–2 hari kerja.
        </p>
        <Button size="lg" className="mt-6 w-full" onClick={() => router.push('/provider/dashboard')}>
          Lihat Dashboard
        </Button>
      </Modal>
    </>
  );
}

/** Disable "Lanjut" while a document on the current step is still uploading. */
function isStepBusy(state: State): boolean {
  if (state.step === 0) return !!state.uploading.ktp;
  if (state.step === 3) return !!state.uploading.face || !!state.uploading.certificate;
  return false;
}

function maskNik(nik: string): string {
  if (nik.length < 16) return nik || '—';
  return `${nik.slice(0, 4)}••••••••${nik.slice(-4)}`;
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

function UploadBox({
  kind,
  label,
  hint,
  required,
  accept = 'image/jpeg,image/png',
  state,
  onPick,
  onClear,
  error,
}: {
  kind: DocKind;
  label: string;
  hint?: string;
  required?: boolean;
  accept?: string;
  state: State;
  onPick: (kind: DocKind, file: File) => void;
  onClear: () => void;
  error?: string;
}) {
  const preview = state.previews[kind];
  const uploading = state.uploading[kind];
  const uploaded = !!state.data[DOC_FIELD[kind]];
  const isImagePreview = preview?.startsWith('blob:') && accept.includes('image');

  return (
    <Field label={label} required={required} error={error} hint={!error ? hint : undefined}>
      {uploaded || preview ? (
        <div className="relative overflow-hidden rounded-xl border border-border">
          {isImagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={`Preview ${label}`}
              className="mx-auto max-h-48 w-full bg-muted/30 object-contain"
            />
          ) : (
            <div className="flex items-center gap-3 p-4">
              <FileText className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-foreground">Dokumen terlampir</span>
            </div>
          )}
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 text-white transition-colors hover:bg-slate-900"
            aria-label={`Hapus ${label}`}
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
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPick(kind, file);
            }}
          />
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
            {kind === 'certificate' ? <FileText className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
          </span>
          <span className="text-sm font-medium text-foreground">Klik untuk upload</span>
          <span className="text-xs text-muted-foreground">{accept.includes('pdf') ? 'PNG, JPG, PDF' : 'PNG, JPG'} hingga 5MB</span>
        </label>
      )}
    </Field>
  );
}
