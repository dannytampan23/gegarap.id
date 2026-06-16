import Link from 'next/link';
import {
  Search,
  Briefcase,
  ShieldCheck,
  MapPin,
  CreditCard,
  Star,
  ArrowRight,
  Sparkles,
  UserCheck,
  CalendarCheck,
  Wallet,
} from 'lucide-react';
import prisma from '@/lib/prisma';
import { buttonVariants } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import MapWrapper from '@/components/map/MapWrapper';
import { PROVIDER_MAP_SELECT, toMapProvider } from '@/lib/providers';

export const dynamic = 'force-dynamic';

const features = [
  {
    icon: ShieldCheck,
    title: 'Tukang Terverifikasi',
    desc: 'Setiap penyedia jasa melewati proses KYC ketat sebelum bisa menerima pekerjaan.',
  },
  {
    icon: MapPin,
    title: 'Hyper-Local',
    desc: 'Temukan tukang terdekat di seluruh DIY lewat peta interaktif yang akurat.',
  },
  {
    icon: CreditCard,
    title: 'Pembayaran Aman',
    desc: 'Sistem DP via Midtrans melindungi Anda — sisanya dibayar setelah pekerjaan selesai.',
  },
];

const steps = [
  {
    icon: Search,
    title: 'Cari & Pilih',
    desc: 'Telusuri tukang berdasarkan keahlian, rating, dan lokasi terdekat.',
  },
  {
    icon: CalendarCheck,
    title: 'Booking & Bayar DP',
    desc: 'Isi detail pekerjaan dan amankan jadwal dengan DP yang transparan.',
  },
  {
    icon: UserCheck,
    title: 'Pekerjaan Selesai',
    desc: 'Tukang datang, pekerjaan beres, lalu lunasi sisa pembayaran.',
  },
];

export default async function Home() {
  // Public-safe columns only; coordinates are fuzzed before reaching the map.
  const providers = await prisma.providerProfile.findMany({
    where: { isVerified: true, available: true },
    select: {
      ...PROVIDER_MAP_SELECT,
      rating: true,
      completedJobs: true,
    },
    orderBy: { rating: 'desc' },
  });

  const mapProviders = providers.map(toMapProvider);

  const count = providers.length;
  const avgRating = count > 0 ? providers.reduce((s, p) => s + p.rating, 0) / count : 0;
  const totalJobs = providers.reduce((s, p) => s + p.completedJobs, 0);

  return (
    <div className="overflow-hidden">
      {/* ===== Hero ===== */}
      <section className="relative">
        <div className="absolute inset-0 -z-10 hero-glow" />
        <div className="absolute inset-0 -z-10 bg-grid" />
        <div className="container py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex animate-fade-down items-center gap-2 rounded-full border border-primary/20 bg-primary-light/60 px-4 py-1.5 text-sm font-semibold text-primary-800">
              <Sparkles className="h-4 w-4" />
              Platform jasa tukang #1 di Yogyakarta
            </div>

            <h1 className="animate-fade-up text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
              Solusi <span className="text-gradient">jasa tukang</span> terpercaya di sekitar Anda
            </h1>

            <p className="animation-delay-100 mx-auto mt-6 max-w-2xl animate-fade-up text-lg text-muted-foreground sm:text-xl">
              Temukan tukang ledeng, listrik, dan kebersihan profesional yang sudah terverifikasi.
              Booking dalam hitungan menit, bayar dengan aman.
            </p>

            <div className="animation-delay-200 mt-10 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/search"
                className={buttonVariants({
                  variant: 'primary',
                  size: 'xl',
                  className: 'w-full sm:w-auto',
                })}
              >
                <Search className="h-5 w-5" />
                Cari Tukang
              </Link>
              <Link
                href="/onboarding"
                className={buttonVariants({
                  variant: 'outline',
                  size: 'xl',
                  className: 'w-full sm:w-auto',
                })}
              >
                <Briefcase className="h-5 w-5 text-primary" />
                Daftar sebagai Tukang
              </Link>
            </div>

            {/* Social proof */}
            <div className="animation-delay-300 mt-10 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
              <div className="flex -space-x-3">
                {providers.slice(0, 4).map((p) => (
                  <Avatar key={p.id} name={p.user.name} size="sm" />
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="font-semibold text-foreground">{avgRating.toFixed(1)}</span>
                <span className="text-muted-foreground">dari {totalJobs}+ pekerjaan</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Stats ===== */}
      <section className="container -mt-6">
        <div className="grid grid-cols-3 gap-3 rounded-3xl border border-border bg-card p-6 shadow-card sm:gap-6 sm:p-8">
          {[
            { value: `${count}+`, label: 'Tukang terverifikasi' },
            { value: avgRating.toFixed(1), label: 'Rating rata-rata' },
            { value: `${totalJobs}+`, label: 'Pekerjaan selesai' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {s.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Features ===== */}
      <section className="container py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Kenapa memilih gegarap.id?
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Dibangun untuk memberi Anda ketenangan di setiap langkah.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="hover-lift rounded-2xl border border-border bg-card p-7 shadow-card"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground">{f.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section className="border-y border-border bg-surface">
        <div className="container py-20">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Cara kerjanya
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Tiga langkah sederhana sampai beres.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.title} className="relative text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-primary shadow-card ring-1 ring-border">
                  <s.icon className="h-7 w-7" />
                </div>
                <div className="mx-auto mt-4 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </div>
                <h3 className="mt-3 text-lg font-bold text-foreground">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Map ===== */}
      <section className="container py-20">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Tukang di sekitar Anda
            </h2>
            <p className="mt-2 text-lg text-muted-foreground">
              Pilih pin pada peta untuk melihat profil dan tarif harian.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-light px-3.5 py-1.5 text-sm font-semibold text-primary-800">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Live di Yogyakarta
          </span>
        </div>
        <MapWrapper providers={mapProviders} />
      </section>

      {/* ===== CTA band ===== */}
      <section className="container pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-14 text-center shadow-elevated sm:px-12 sm:py-20">
          <div className="absolute inset-0 -z-0 opacity-40 hero-glow" />
          <div className="relative z-10 mx-auto max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white">
              <Wallet className="h-4 w-4" />
              Penghasilan tambahan menanti
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Punya keahlian? Jadikan penghasilan.
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              Bergabunglah sebagai mitra tukang dan dapatkan pelanggan baru di seluruh Yogyakarta —
              gratis, tanpa biaya pendaftaran.
            </p>
            <Link
              href="/onboarding"
              className={buttonVariants({ variant: 'primary', size: 'xl', className: 'mt-8' })}
            >
              Mulai Daftar Sekarang
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
