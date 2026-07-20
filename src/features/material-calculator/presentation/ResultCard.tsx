'use client';

import Link from 'next/link';
import { Wallet, Users, ArrowRight, Package, Info } from 'lucide-react';
import { buttonVariants } from '@/components/ui/Button';
import { formatCurrency, cn } from '@/lib/utils';
import type { CalculationResult } from '../domain/types';

/** Format a material quantity: whole numbers stay whole, fractions show 2 dp. */
function formatQty(qty: number): string {
  return Number.isInteger(qty)
    ? String(qty)
    : qty.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

export function ResultCard({ result }: { result: CalculationResult }) {
  const showCost = result.totalCost > 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/20 bg-primary-light p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Estimasi total
            </p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-primary sm:text-4xl">
              {showCost ? formatCurrency(result.totalCost) : '-'}
            </p>
          </div>
          <div className="text-sm text-primary-800">
            <p className="font-semibold">{result.jobLabel}</p>
            <p className="text-primary-800/75">{result.materials.length} jenis material</p>
          </div>
        </div>
      </div>

      {result.metrics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.metrics.map((m) => (
            <span
              key={m.key}
              className="inline-flex items-baseline gap-1.5 rounded-lg bg-primary-light px-3 py-1.5 text-sm text-primary-800"
            >
              <span className="font-medium text-primary-800/80">{m.label}:</span>
              <span className="font-bold">
                {formatQty(m.value)} {m.unit}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
          <Package className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Rincian Kebutuhan Material</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Material</th>
                <th className="px-4 py-2.5 text-right font-semibold">Volume</th>
                <th className="px-4 py-2.5 text-right font-semibold">Harga</th>
                <th className="px-4 py-2.5 text-right font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.materials.map((line) => (
                <tr key={line.material} className={cn(line.quantity <= 0 && 'opacity-50')}>
                  <td className="px-4 py-3 font-medium text-foreground">{line.label}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-foreground">
                    {formatQty(line.quantity)} {line.unit}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {line.unitPrice > 0 ? formatCurrency(line.unitPrice) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                    {line.cost > 0 ? formatCurrency(line.cost) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Subtotal material</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatCurrency(result.materialCost)}
          </span>
        </div>
        {result.labor && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Upah tukang ({result.labor.workers} orang x {result.labor.days} hari)
            </span>
            <span className="font-semibold tabular-nums text-amber-600">
              {formatCurrency(result.labor.cost)}
            </span>
          </div>
        )}
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="flex items-center gap-2 font-bold text-foreground">
            <Wallet className="h-4 w-4 text-primary" />
            Total
          </span>
          <span className="text-xl font-extrabold tabular-nums text-primary">
            {showCost ? formatCurrency(result.totalCost) : '-'}
          </span>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Estimasi bersifat indikatif berdasarkan koefisien standar. Harga & volume riil dapat berbeda
        menurut lokasi, spesifikasi, dan kondisi lapangan.
      </p>

      <Link
        href="/search?category=Tukang%20Bangunan"
        className={buttonVariants({ variant: 'primary', size: 'lg', className: 'w-full' })}
      >
        Cari Tukang untuk Kerjakan Ini
        <ArrowRight className="h-5 w-5" />
      </Link>
    </div>
  );
}
