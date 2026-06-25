'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, SearchX, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { buttonVariants } from '@/components/ui/Button';
import type { ProviderListItem } from '@/lib/types';
import { ProviderCard } from './ProviderCard';
import { SearchFilters, type SortKey } from './SearchFilters';

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const SORT_KEYS: SortKey[] = ['rating', 'price-asc', 'price-desc', 'reviews', 'available'];

export function SearchClient({
  providers,
  initialCategory = 'Semua',
  initialQuery = '',
}: {
  providers: ProviderListItem[];
  initialCategory?: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // ── Derived option sets / bounds (stable; from the server-fetched list) ──
  const categories = React.useMemo(
    () => ['Semua', ...Array.from(new Set(providers.map((p) => p.category)))],
    [providers]
  );
  const areas = React.useMemo(
    () =>
      Array.from(new Set(providers.flatMap((p) => p.districts))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [providers]
  );
  const { priceFloor, priceCeil } = React.useMemo(() => {
    if (providers.length === 0) return { priceFloor: 50_000, priceCeil: 500_000 };
    const rates = providers.map((p) => p.dailyRate);
    const lo = Math.floor(Math.min(...rates) / 10_000) * 10_000;
    const hi = Math.ceil(Math.max(...rates) / 10_000) * 10_000;
    return { priceFloor: lo, priceCeil: hi === lo ? lo + 10_000 : hi };
  }, [providers]);

  // ── Filter state, hydrated once from the URL so links are shareable ──
  const [category, setCategory] = React.useState(initialCategory);
  const [query, setQuery] = React.useState(initialQuery);
  const [sort, setSort] = React.useState<SortKey>(() => {
    const s = sp.get('sort') as SortKey | null;
    return s && SORT_KEYS.includes(s) ? s : 'rating';
  });
  const [availableOnly, setAvailableOnly] = React.useState(() => sp.get('available') === '1');
  const [selectedAreas, setSelectedAreas] = React.useState<string[]>(() => {
    const raw = sp.get('area');
    return raw ? raw.split(',').filter((a) => areas.includes(a)) : [];
  });
  const [priceMin, setPriceMin] = React.useState(() =>
    clamp(Number(sp.get('min')) || priceFloor, priceFloor, priceCeil)
  );
  const [priceMax, setPriceMax] = React.useState(() =>
    clamp(Number(sp.get('max')) || priceCeil, priceFloor, priceCeil)
  );
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // ── Persist active filters to the URL (debounced; no entry per keystroke) ──
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (category !== 'Semua') params.set('category', category);
    if (query.trim()) params.set('q', query.trim());
    if (sort !== 'rating') params.set('sort', sort);
    if (priceMin > priceFloor) params.set('min', String(priceMin));
    if (priceMax < priceCeil) params.set('max', String(priceMax));
    if (selectedAreas.length) params.set('area', selectedAreas.join(','));
    if (availableOnly) params.set('available', '1');
    const qs = params.toString();
    const t = setTimeout(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [
    category,
    query,
    sort,
    priceMin,
    priceMax,
    selectedAreas,
    availableOnly,
    priceFloor,
    priceCeil,
    pathname,
    router,
  ]);

  // Lock body scroll while the mobile filter sheet is open.
  React.useEffect(() => {
    if (!sheetOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sheetOpen]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = providers.filter((p) => {
      if (category !== 'Semua' && p.category !== category) return false;
      if (availableOnly && !p.available) return false;
      if (p.dailyRate < priceMin || p.dailyRate > priceMax) return false;
      if (selectedAreas.length && !p.districts.some((d) => selectedAreas.includes(d))) return false;
      if (
        q &&
        !p.user.name.toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q) &&
        !(p.bio ?? '').toLowerCase().includes(q) &&
        !p.districts.some((d) => d.toLowerCase().includes(q))
      )
        return false;
      return true;
    });

    return [...list].sort((a, b) => {
      switch (sort) {
        case 'price-asc':
          return a.dailyRate - b.dailyRate;
        case 'price-desc':
          return b.dailyRate - a.dailyRate;
        case 'reviews':
          return b.ratingCount - a.ratingCount;
        case 'available':
          return Number(b.available) - Number(a.available) || b.rating - a.rating;
        default:
          return b.rating - a.rating;
      }
    });
  }, [providers, category, query, sort, priceMin, priceMax, selectedAreas, availableOnly]);

  const activeCount =
    (category !== 'Semua' ? 1 : 0) +
    (query.trim() ? 1 : 0) +
    (sort !== 'rating' ? 1 : 0) +
    (priceMin > priceFloor || priceMax < priceCeil ? 1 : 0) +
    (selectedAreas.length > 0 ? 1 : 0) +
    (availableOnly ? 1 : 0);

  function reset() {
    setCategory('Semua');
    setQuery('');
    setSort('rating');
    setPriceMin(priceFloor);
    setPriceMax(priceCeil);
    setSelectedAreas([]);
    setAvailableOnly(false);
  }

  const filtersProps = {
    categories,
    category,
    onCategory: setCategory,
    sort,
    onSort: setSort,
    priceFloor,
    priceCeil,
    priceMin,
    priceMax,
    onPrice: (lo: number, hi: number) => {
      setPriceMin(lo);
      setPriceMax(hi);
    },
    areas,
    selectedAreas,
    onToggleArea: (a: string) =>
      setSelectedAreas((prev) =>
        prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
      ),
    availableOnly,
    onAvailableOnly: setAvailableOnly,
    activeCount,
    onReset: reset,
  };

  // Replay the card stagger whenever the visible set meaningfully changes.
  const gridKey = `${category}|${sort}|${selectedAreas.join(',')}|${availableOnly}`;

  return (
    <div>
      {/* Top search bar (full width); sort/price/area live in the filter panel) */}
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari nama, keahlian, atau area tukang..."
        leftIcon={<Search className="h-4.5 w-4.5" />}
        aria-label="Cari tukang"
      />

      <div className="mt-6 lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <SearchFilters {...filtersProps} />
          </div>
        </aside>

        {/* Results column */}
        <div>
          <p className="mb-5 text-sm text-muted-foreground">
            Menampilkan <span className="font-semibold text-foreground">{results.length}</span>{' '}
            tukang
            {category !== 'Semua' && (
              <>
                {' '}
                untuk <span className="font-semibold text-foreground">{category}</span>
              </>
            )}
          </p>

          {results.length > 0 ? (
            <div
              key={gridKey}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2"
            >
              {results.map((p, i) => (
                <div
                  key={p.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
                >
                  <ProviderCard provider={p} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<SearchX className="h-7 w-7" />}
              title="Belum ada tukang di area ini"
              description="Coba ganti kategori, perluas rentang harga, atau perlebar area pencarianmu."
              action={
                activeCount > 0 ? (
                  <button onClick={reset} className={buttonVariants({ variant: 'primary' })}>
                    Reset Filter
                  </button>
                ) : (
                  <Link href="/onboarding" className={buttonVariants({ variant: 'primary' })}>
                    Daftar jadi tukang pertama di area ini
                  </Link>
                )
              }
            />
          )}
        </div>
      </div>

      {/* Mobile: floating filter trigger */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-elevated lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filter &amp; Urutkan
        {activeCount > 0 && (
          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/25 px-1 text-xs">
            {activeCount}
          </span>
        )}
      </button>

      {/* Mobile: bottom sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-slate-900/40"
            onClick={() => setSheetOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] animate-fade-up overflow-y-auto rounded-t-3xl bg-card p-5 shadow-elevated">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-foreground">Filter &amp; Urutkan</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Tutup filter"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SearchFilters {...filtersProps} />
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className={buttonVariants({ variant: 'primary', className: 'mt-5 w-full' })}
            >
              Lihat {results.length} tukang
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
