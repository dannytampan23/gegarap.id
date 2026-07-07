import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import { Shield, MapPin, Eye } from 'lucide-react';
import { buttonVariants } from '@/components/ui/Button';

export const metadata = pageMetadata({
  title: 'Tentang Kami',
  description:
    'gegarap.id lahir di Jogja untuk menghubungkan warga dengan tukang terverifikasi secara hyperlocal.',
  path: '/about',
});

const values = [
  {
    icon: Shield,
    title: 'Kepercayaan',
    body: 'Setiap mitra melewati verifikasi identitas internal sebelum profilnya aktif. Anda memesan dengan tenang.',
  },
  {
    icon: MapPin,
    title: 'Hiperlokal',
    body: 'Fokus pada Daerah Istimewa Yogyakarta — tukang yang benar-benar dekat dengan rumah Anda.',
  },
  {
    icon: Eye,
    title: 'Transparan',
    body: 'Tarif, DP, dan biaya platform ditampilkan jelas di muka. Tanpa biaya tersembunyi.',
  },
];

export default function AboutPage() {
  return (
    <div className="container py-12 sm:py-16">
      {/* Hero */}
      <section className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary-800">
          <MapPin className="h-3.5 w-3.5" />
          Daerah Istimewa Yogyakarta
        </span>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          Lahir di Jogja, untuk Jogja
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          gegarap.id hadir karena mencari tukang yang tepercaya seharusnya semudah memesan makanan.
          Kami menghubungkan warga Yogyakarta dengan tukang ledeng, listrik, kebersihan, kebun, dan
          bangunan yang sudah terverifikasi — cepat, aman, dan transparan.
        </p>
      </section>

      {/* Values */}
      <section className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-3">
        {values.map((v) => {
          const Icon = v.icon;
          return (
            <div key={v.title} className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-foreground">{v.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
            </div>
          );
        })}
      </section>

      {/* Team placeholder */}
      <section className="mx-auto mt-16 max-w-4xl">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">
          Tim di balik gegarap.id
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
          Sekelompok kecil orang Jogja yang percaya teknologi bisa memberdayakan tukang lokal.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface p-6 text-center"
            >
              <div className="h-20 w-20 rounded-full bg-muted" />
              <div className="mt-4 h-3.5 w-24 rounded-full bg-muted" />
              <div className="mt-2 h-3 w-16 rounded-full bg-muted/70" />
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto mt-16 max-w-3xl rounded-3xl border border-border bg-surface p-8 text-center sm:p-12">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Bergabung dengan gerakan ini
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
          Mau menawarkan jasa atau butuh tukang? Mulai dari sini.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/onboarding" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
            Bergabung sebagai Mitra
          </Link>
          <Link href="/search" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Cari Tukang
          </Link>
        </div>
      </section>
    </div>
  );
}
