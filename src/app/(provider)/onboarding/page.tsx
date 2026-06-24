import { pageMetadata } from '@/lib/seo';
import { ShieldCheck, TrendingUp, Users } from 'lucide-react';
import StepForm from '@/components/onboarding/StepForm';

export const metadata = pageMetadata({
  title: 'Daftar sebagai Tukang',
  description:
    'Bergabung sebagai mitra tukang di gegarap.id dan dapatkan pelanggan baru di Yogyakarta.',
  path: '/onboarding',
});

const perks = [
  { icon: Users, label: 'Akses ribuan pelanggan baru' },
  { icon: TrendingUp, label: 'Atur tarif & jadwal sendiri' },
  { icon: ShieldCheck, label: 'Pembayaran dijamin aman' },
];

export default function OnboardingPage() {
  return (
    <div className="container py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Daftar sebagai Tukang
          </h1>
          <p className="mt-2 text-base text-muted-foreground sm:text-lg">
            Isi data diri Anda untuk mulai mendapatkan pekerjaan di gegarap.id — gratis, tanpa biaya
            pendaftaran.
          </p>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {perks.map((p) => (
            <div
              key={p.label}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-soft"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                <p.icon className="h-4.5 w-4.5" />
              </span>
              <span className="text-sm font-medium text-foreground">{p.label}</span>
            </div>
          ))}
        </div>

        <StepForm />
      </div>
    </div>
  );
}
