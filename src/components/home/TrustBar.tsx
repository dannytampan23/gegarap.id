import { ShieldCheck, BadgeCheck, Star, MapPin, Award, type LucideIcon } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';

/**
 * Trust badge bar (master prompt §1B). Sits directly under the hero CTA as the
 * first thing a new visitor reads. Server component — the staggered entrance is
 * the project's CSS/IntersectionObserver {@link Reveal}, no client JS.
 *
 * On mobile the row scrolls horizontally (single line, scrollbar hidden); from
 * `lg` up the five badges share the width evenly with no scroll.
 */
interface TrustBadge {
  icon: LucideIcon;
  title: string;
  sub: string;
}

const BADGES: TrustBadge[] = [
  { icon: ShieldCheck, title: 'Pembayaran Aman', sub: 'Dijamin Midtrans' },
  { icon: BadgeCheck, title: 'Tukang Terverifikasi', sub: 'KYC & foto asli' },
  { icon: Star, title: 'Rating Terpercaya', sub: 'Ulasan asli pengguna' },
  { icon: MapPin, title: 'Hyper-Local DIY', sub: 'Tukang terdekat darimu' },
  { icon: Award, title: 'Garansi Kepuasan', sub: 'Bayar setelah beres' },
];

export function TrustBar() {
  return (
    <section className="container -mt-2 sm:mt-0" aria-label="Jaminan kepercayaan gegarap.id">
      <div className="flex gap-3 overflow-x-auto rounded-2xl border border-border bg-card p-4 shadow-soft scrollbar-hide sm:gap-4 sm:p-5">
        {BADGES.map((b, i) => (
          <Reveal
            key={b.title}
            delay={i * 100}
            className="flex min-w-[140px] flex-1 flex-col items-center gap-2 px-2 text-center sm:min-w-0"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
              <b.icon className="h-5 w-5" />
            </span>
            <span className="text-sm font-bold leading-tight text-foreground">{b.title}</span>
            <span className="text-xs leading-tight text-muted-foreground">{b.sub}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export default TrustBar;
