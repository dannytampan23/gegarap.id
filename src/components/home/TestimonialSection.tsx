'use client';

import * as React from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { cn } from '@/lib/utils';

/**
 * Homepage testimonials (master prompt §1A). Dependency-free carousel — native
 * horizontal scroll-snap (swipeable on touch) with a lightweight auto-advance
 * that pauses on hover/focus and is disabled under `prefers-reduced-motion`.
 * No carousel library, in keeping with the project's lean-deps approach.
 */

interface Testimonial {
  name: string;
  area: string;
  rating: number;
  text: string;
  worker: string;
  category: string;
  daysAgo: number;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Dewi Rahayu',
    area: 'Sleman',
    rating: 5,
    text: 'Budi dateng tepat waktu, masalah pipa bocor langsung beres kurang dari 1 jam. Harganya transparan, gak ada biaya tambahan.',
    worker: 'Budi Santoso',
    category: 'Tukang Ledeng',
    daysAgo: 3,
  },
  {
    name: 'Rizky Firmansyah',
    area: 'Bantul',
    rating: 5,
    text: 'Agus sangat profesional. Instalasi listrik kamar baru selesai rapi dan aman. Punya sertifikat PLN juga.',
    worker: 'Agus Pratama',
    category: 'Tukang Listrik',
    daysAgo: 7,
  },
  {
    name: 'Sinta Maharani',
    area: 'Kotagede',
    rating: 5,
    text: 'Sudah 3x pakai Siti buat general cleaning. Hasil selalu memuaskan, rumah jadi bersih banget.',
    worker: 'Siti Rahayu',
    category: 'Pembersih Rumah',
    daysAgo: 14,
  },
  {
    name: 'Hendra Kusuma',
    area: 'Gondokusuman',
    rating: 4,
    text: 'Eko renovasi kamar mandi kami. Hasilnya bagus, komunikasinya juga lancar. Harga sesuai kesepakatan.',
    worker: 'Eko Nugroho',
    category: 'Tukang Bangunan',
    daysAgo: 21,
  },
  {
    name: 'Ayu Lestari',
    area: 'Mlati',
    rating: 5,
    text: 'Joko merawat taman kami tiap bulan. Taman jadi lebih asri, dia juga kasih saran tanaman yang cocok.',
    worker: 'Joko Widodo',
    category: 'Tukang Kebun',
    daysAgo: 5,
  },
];

function timeAgo(days: number): string {
  if (days < 7) return `${days} hari lalu`;
  const weeks = Math.round(days / 7);
  return `${weeks} minggu lalu`;
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating ${value} dari 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-4 w-4',
            i < value ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}

function TestimonialCard({ t }: { t: Testimonial }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <article className="flex h-full snap-start flex-col rounded-2xl border border-border bg-card p-6 shadow-card">
      <Quote className="h-7 w-7 text-primary/20" aria-hidden />

      <p
        className={cn(
          'mt-2 flex-1 text-sm leading-relaxed text-foreground',
          !expanded && 'line-clamp-3'
        )}
      >
        {t.text}
      </p>
      {t.text.length > 110 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 self-start text-xs font-semibold text-primary hover:text-primary-hover"
        >
          {expanded ? 'Tutup' : 'Baca selengkapnya'}
        </button>
      )}

      <div className="mt-4">
        <Stars value={t.rating} />
      </div>

      <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
        {/* External placeholder avatars for seed testimonials — plain img avoids
            wiring i.pravatar.cc into next/image remotePatterns. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://i.pravatar.cc/80?u=${encodeURIComponent(t.name)}`}
          alt={`Foto ${t.name}`}
          width={48}
          height={48}
          loading="lazy"
          className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white shadow-soft"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{t.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t.area} · {timeAgo(t.daysAgo)}
          </p>
        </div>
      </div>

      <p className="mt-3 truncate text-xs text-muted-foreground">
        Memakai{' '}
        <span className="font-semibold text-foreground">{t.worker}</span> · {t.category}
      </p>
    </article>
  );
}

export function TestimonialSection() {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const pausedRef = React.useRef(false);

  // Auto-advance one card every 4s; pause on hover/focus, skip under
  // prefers-reduced-motion. Loops back to the start when it reaches the end.
  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      const first = scroller.firstElementChild as HTMLElement | null;
      if (!first) return;
      const step = first.offsetWidth + 24; // card width + gap-6
      const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 8;
      scroller.scrollTo({ left: atEnd ? 0 : scroller.scrollLeft + step, behavior: 'smooth' });
    }, 4000);

    return () => window.clearInterval(id);
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const first = scroller.firstElementChild as HTMLElement | null;
    const step = first ? first.offsetWidth + 24 : 320;
    scroller.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <section className="border-y border-border bg-surface">
      <div className="container py-20">
        <Reveal className="mb-10 flex flex-col gap-4 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
          <div className="mx-auto max-w-2xl sm:mx-0">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Dipercaya warga Yogyakarta
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Cerita nyata dari pengguna yang pekerjaannya beres lewat gegarap.id.
            </p>
          </div>
          <div className="flex justify-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label="Testimoni sebelumnya"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft transition-colors hover:border-primary/40 hover:text-primary"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label="Testimoni berikutnya"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft transition-colors hover:border-primary/40 hover:text-primary"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </Reveal>

        <div
          ref={scrollerRef}
          onMouseEnter={() => (pausedRef.current = true)}
          onMouseLeave={() => (pausedRef.current = false)}
          onFocusCapture={() => (pausedRef.current = true)}
          onBlurCapture={() => (pausedRef.current = false)}
          onTouchStart={() => (pausedRef.current = true)}
          className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-2 scrollbar-hide"
        >
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="w-[85%] shrink-0 sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
            >
              <TestimonialCard t={t} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TestimonialSection;
