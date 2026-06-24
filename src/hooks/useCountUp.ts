'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from 0 up to `end` over `duration` ms using
 * requestAnimationFrame with an ease-out curve. Re-runs whenever `end` changes
 * (e.g. when the SWR value arrives). Honours `prefers-reduced-motion` by jumping
 * straight to the final value. Returns the current animated value; the caller
 * formats it (grouping / decimals).
 */
export function useCountUp(end: number, duration = 1500): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || duration <= 0 || end === 0) {
      setValue(end);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(end * eased);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setValue(end); // land exactly on the target
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [end, duration]);

  return value;
}
