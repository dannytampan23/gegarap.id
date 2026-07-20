'use client';

import { cn } from '@/lib/utils';
import type { Formula } from '../domain/types';
import { resolveIcon } from './icons';

interface JobSelectorProps {
  formulas: readonly Formula[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/** Grid of job cards. Selecting a job swaps the entire input set + result. */
export function JobSelector({ formulas, selectedId, onSelect }: JobSelectorProps) {
  const selected = formulas.find((f) => f.id === selectedId) ?? formulas[0];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Langkah 1</p>
          <h2 className="text-lg font-bold text-foreground">Pilih pekerjaan</h2>
        </div>
        <p className="text-sm text-muted-foreground">{selected.group}</p>
      </div>

      <div
        role="radiogroup"
        aria-label="Jenis pekerjaan"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
      >
        {formulas.map((f) => {
          const Icon = resolveIcon(f.icon);
          const active = f.id === selectedId;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(f.id)}
              className={cn(
                'group flex min-h-28 flex-col items-start justify-between gap-2 rounded-xl border p-3 text-left transition-all focus:outline-none focus:ring-4 focus:ring-primary/10',
                active
                  ? 'border-primary/60 bg-primary-light shadow-glow'
                  : 'border-border bg-background hover:border-primary/30 hover:bg-muted/40'
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                  active ? 'bg-primary text-primary-foreground' : 'bg-muted text-primary'
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="w-full">
                <span
                  className={cn(
                    'block text-sm font-bold leading-tight',
                    active ? 'text-primary-800' : 'text-foreground'
                  )}
                >
                  {f.label}
                </span>
                <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                  {f.group}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
