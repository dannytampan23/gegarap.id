'use client';

import * as React from 'react';
import { LayoutGrid, RotateCcw, type LucideIcon } from 'lucide-react';
import { CATEGORY_META } from '@/components/home/categories';
import { cn } from '@/lib/utils';

export type SortKey = 'rating' | 'price-asc' | 'price-desc' | 'reviews' | 'available';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'rating', label: 'Rating Tertinggi' },
  { value: 'price-asc', label: 'Harga Termurah' },
  { value: 'price-desc', label: 'Harga Tertinggi' },
  { value: 'reviews', label: 'Paling Banyak Ulasan' },
  { value: 'available', label: 'Tersedia Hari Ini' },
];

const CATEGORY_ICON: Record<string, LucideIcon> = Object.fromEntries(
  CATEGORY_META.map((c) => [c.name, c.icon])
);

function formatK(v: number) {
  return v >= 1_000_000 ? `Rp ${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}jt` : `Rp ${Math.round(v / 1000)}k`;
}

/** Dependency-free dual-thumb slider (two overlaid native range inputs). */
function RangeSlider({
  min,
  max,
  step,
  valueMin,
  valueMax,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
}) {
  const range = max - min || 1;
  const pctMin = ((valueMin - min) / range) * 100;
  const pctMax = ((valueMax - min) / range) * 100;

  return (
    <div className="relative h-5">
      <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-muted" />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
        style={{ left: `${pctMin}%`, right: `${100 - pctMax}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMin}
        aria-label="Harga minimum"
        onChange={(e) => onChange(Math.min(Number(e.target.value), valueMax - step), valueMax)}
        className="range-thumb absolute top-1/2 h-5 w-full -translate-y-1/2"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMax}
        aria-label="Harga maksimum"
        onChange={(e) => onChange(valueMin, Math.max(Number(e.target.value), valueMin + step))}
        className="range-thumb absolute top-1/2 h-5 w-full -translate-y-1/2"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border py-5 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-sm font-bold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

export interface SearchFiltersProps {
  categories: string[];
  category: string;
  onCategory: (c: string) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  priceFloor: number;
  priceCeil: number;
  priceMin: number;
  priceMax: number;
  onPrice: (min: number, max: number) => void;
  areas: string[];
  selectedAreas: string[];
  onToggleArea: (a: string) => void;
  availableOnly: boolean;
  onAvailableOnly: (v: boolean) => void;
  activeCount: number;
  onReset: () => void;
}

export function SearchFilters(props: SearchFiltersProps) {
  const {
    categories,
    category,
    onCategory,
    sort,
    onSort,
    priceFloor,
    priceCeil,
    priceMin,
    priceMax,
    onPrice,
    areas,
    selectedAreas,
    onToggleArea,
    availableOnly,
    onAvailableOnly,
    activeCount,
    onReset,
  } = props;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-foreground">
          Filter{activeCount > 0 && <span className="ml-1 text-primary">({activeCount})</span>}
        </h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>

      <div className="mt-4">
        <Section title="Kategori">
          <div className="flex flex-col gap-1">
            {categories.map((c) => {
              const Icon = c === 'Semua' ? LayoutGrid : CATEGORY_ICON[c];
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCategory(c)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary-light text-primary-800'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      active ? 'border-primary' : 'border-muted-foreground/40'
                    )}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80" />}
                  {c}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Urutkan">
          <div className="flex flex-col gap-1">
            {SORT_OPTIONS.map((o) => {
              const active = sort === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onSort(o.value)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary-light text-primary-800'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      active ? 'border-primary' : 'border-muted-foreground/40'
                    )}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  {o.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Rentang Harga / hari">
          <p className="mb-3 text-sm font-semibold text-foreground">
            {formatK(priceMin)} – {formatK(priceMax)}
          </p>
          <RangeSlider
            min={priceFloor}
            max={priceCeil}
            step={10_000}
            valueMin={priceMin}
            valueMax={priceMax}
            onChange={onPrice}
          />
        </Section>

        {areas.length > 0 && (
          <Section title="Area Kecamatan">
            <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto pr-1">
              {areas.map((a) => {
                const checked = selectedAreas.includes(a);
                return (
                  <label
                    key={a}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleArea(a)}
                      className="h-4 w-4 shrink-0 rounded border-muted-foreground/40 text-primary accent-primary"
                    />
                    <span className={cn(checked && 'font-semibold text-foreground')}>{a}</span>
                  </label>
                );
              })}
            </div>
          </Section>
        )}

        <Section title="Ketersediaan">
          <button
            type="button"
            role="switch"
            aria-checked={availableOnly}
            onClick={() => onAvailableOnly(!availableOnly)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
          >
            Tersedia hari ini saja
            <span
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                availableOnly ? 'bg-primary' : 'bg-muted-foreground/30'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-transform',
                  availableOnly ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                )}
              />
            </span>
          </button>
        </Section>
      </div>
    </div>
  );
}
