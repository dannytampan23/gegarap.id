'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * A button/link with a material-style ripple that blooms from the click point,
 * plus a soft press-scale. Renders a Next `Link` when `href` is set, otherwise a
 * native `<button>`. The ripple is pure CSS (`animate-ripple`, defined in
 * globals.css) so it stays cheap and is neutralised under reduced-motion.
 */
type Ripple = { id: number; x: number; y: number; size: number };

interface RippleButtonProps {
  href?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string;
  rippleClassName?: string;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
  'aria-label'?: string;
}

export function RippleButton({
  href,
  type = 'button',
  disabled,
  className,
  rippleClassName,
  children,
  onClick,
  'aria-label': ariaLabel,
}: RippleButtonProps) {
  const [ripples, setRipples] = React.useState<Ripple[]>([]);
  const idRef = React.useRef(0);

  const spawn = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const id = idRef.current++;
    setRipples((r) => [
      ...r,
      { id, size, x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2 },
    ]);
    // Drop the ripple once its animation is done to keep the DOM tidy.
    window.setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 650);
  };

  const content = (
    <>
      {children}
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden
          className={cn(
            'pointer-events-none absolute animate-ripple rounded-full bg-white/40',
            rippleClassName
          )}
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
    </>
  );

  const shared = cn(
    'relative isolate overflow-hidden transition-transform duration-150 active:scale-[0.97]',
    className
  );

  if (href) {
    return (
      <Link href={href} className={shared} onPointerDown={spawn} onClick={onClick} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      className={shared}
      onPointerDown={spawn}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {content}
    </button>
  );
}
