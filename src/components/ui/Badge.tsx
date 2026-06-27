import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'primary' | 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

const variants: Record<BadgeVariant, string> = {
  primary: 'bg-primary-light text-primary-800',
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  outline: 'border border-border bg-card text-foreground',
};

export function Badge({
  className,
  variant = 'primary',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
