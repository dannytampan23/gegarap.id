import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Horizontal 5-step KYC progress indicator with connector lines.
 *  - done   → green circle with a check
 *  - active → green circle, bold label, focus ring
 *  - todo   → grey circle
 * `current` is the zero-based index of the active step.
 */
export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <nav aria-label="Langkah pendaftaran KYC">
      <ol className="flex items-start">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="relative flex flex-1 flex-col items-center text-center">
              {/* Connector into this step (sits behind the circle). */}
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute right-1/2 top-[18px] h-0.5 w-full -translate-y-1/2 rounded-full',
                    i <= current ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}

              <span
                className={cn(
                  'relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/15',
                  !done && !active && 'border-border bg-muted text-muted-foreground'
                )}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <Check className="h-4.5 w-4.5" aria-hidden /> : i + 1}
              </span>

              <span
                className={cn(
                  'mt-2 px-1 text-[11px] leading-tight sm:text-xs',
                  active ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Proses verifikasi KYC membutuhkan 1–2 hari kerja.
      </p>
    </nav>
  );
}

export default StepIndicator;
