import Link from 'next/link';
import {
  Search,
  ShieldCheck,
  MapPin,
  CreditCard,
  ArrowRight,
  UserCheck,
  CalendarCheck,
  Wallet,
} from 'lucide-react';
import prisma from '@/lib/prisma';
import { buttonVariants } from '@/components/ui/Button';
import WorkerMap from '@/components/map/WorkerMap';
import { JsonLd } from '@/components/seo/JsonLd';
import { localBusinessJsonLd } from '@/lib/seo';
import { Reveal } from '@/components/motion/Reveal';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { StatsSection } from '@/components/home/StatsSection';
import { TrustBar } from '@/components/home/TrustBar';
import { TestimonialSection } from '@/components/home/TestimonialSection';
import { Hero3D } from '@/components/sections/Hero3D';

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

export default async function MarketingHome() {
  // Only rating fields are needed here now — the stats band and the map both
  // fetch their own data client-side (/api/stats, /api/workers). This query just
  // feeds the LocalBusiness structured-data aggregate rating.
  const providers = await prisma.providerProfile.findMany({
    where: { isVerified: true, available: true },
    select: { rating: true, ratingCount: true },
  });

  const count = providers.length;
  const totalReviews = providers.reduce((s, p) => s + p.ratingCount, 0);
  // Review-weighted average so the structured-data rating reflects real reviews.
  const avgRating =
    totalReviews > 0
      ? providers.reduce((s, p) => s + p.rating * p.ratingCount, 0) / totalReviews
      : count > 0
        ? providers.reduce((s, p) => s + p.rating, 0) / count
        : 0;

  return (
    <div className="overflow-hidden">
      <JsonLd data={localBusinessJsonLd({ ratingValue: avgRating, reviewCount: totalReviews })} />

      {/* ===== Hero (3D + smart search) ===== */}
      <Hero3D />

      {/* ===== Trust badges (first thing a new visitor reads) ===== */}
      <TrustBar />

      {/* ===== Stats (self-fetching; hides itself on zero/error) ===== */}
      <StatsSection />

      {/* ===== Categories ===== */}
      <CategoryGrid />

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
          {features.map((f, i) => (
            <Reveal
              key={f.title}
              delay={i * 90}
              className="hover-lift rounded-2xl border border-border bg-card p-7 shadow-card"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground">{f.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{f.desc}</p>
            </Reveal>
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
          <div className="relative grid gap-8 md:grid-cols-3">
            {/* Connector line drawn in on scroll (md+, behind the step icons) */}
            <Reveal
              variant="line"
              delay={150}
              className="absolute left-[16.6%] right-[16.6%] top-8 hidden h-0.5 bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20 md:block"
            />
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 120} className="relative text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-primary shadow-card ring-1 ring-border">
                  <s.icon className="h-7 w-7" />
                </div>
                <div className="mx-auto mt-4 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </div>
                <h3 className="mt-3 text-lg font-bold text-foreground">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{s.desc}</p>
              </Reveal>
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
              Pilih pin pada peta untuk melihat profil dan estimasi tarif.
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
        <WorkerMap />
      </section>

      {/* ===== Testimonials (social proof) ===== */}
      <TestimonialSection />

      {/* ===== CTA band ===== */}
      <section className="container pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-14 text-center shadow-elevated sm:px-12 sm:py-20">
          <div className="absolute inset-0 -z-0 opacity-40 hero-glow" />
          <Reveal className="relative z-10 mx-auto max-w-2xl">
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
          </Reveal>
        </div>
      </section>
    </div>
  );
}
