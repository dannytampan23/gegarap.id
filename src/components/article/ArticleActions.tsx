'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Wrench, ArrowRight, X } from 'lucide-react';
import { RippleButton } from '@/components/ui/RippleButton';

/**
 * Progressive-enhancement action layer for an article:
 *  - a floating "Tanya AI tentang artikel ini" button (→ /asisten, prefilled)
 *  - a sticky "Butuh bantuan? Panggil Tukang" conversion bar
 *
 * Both reveal after the reader scrolls past the intro so they never cover the
 * headline, and both are dismissible. The article body is fully server-rendered
 * — nothing here hides content, so SEO/no-JS readers are unaffected.
 */
export function ArticleActions({
  searchHref,
  ctaLabel,
  asistenHref,
}: {
  /** Deep link into search for the article's category (Panggil Tukang). */
  searchHref: string;
  /** Category-specific CTA copy already resolved server-side. */
  ctaLabel: string;
  /** /asisten link with the article context prefilled as `?q=`. */
  asistenHref: string;
}) {
  const [shown, setShown] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const visible = shown && !dismissed;

  return (
    <>
      {/* Floating "Tanya AI" — sits above the sticky bar */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="fixed bottom-[5.5rem] right-4 z-40 sm:bottom-24"
          >
            <Link
              href={asistenHref}
              className="group flex items-center gap-2 rounded-full bg-slate-900 py-3 pl-4 pr-5 text-sm font-semibold text-white shadow-elevated transition-transform hover:scale-105"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </span>
              Tanya AI tentang artikel ini
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky "Panggil Tukang" conversion bar */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="fixed inset-x-0 bottom-0 z-40"
          >
            <div className="container px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              <div className="glass flex items-center gap-3 rounded-2xl border border-border/70 p-2.5 shadow-elevated sm:p-3">
                <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary sm:flex">
                  <Wrench className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground sm:text-base">
                    Butuh bantuan? Panggil Tukang
                  </p>
                  <p className="hidden truncate text-xs text-muted-foreground sm:block">
                    Tukang terverifikasi Gegarap, harga transparan.
                  </p>
                </div>
                <RippleButton
                  href={searchHref}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow hover:bg-primary-hover sm:px-5"
                >
                  <span className="max-w-[9rem] truncate">{ctaLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </RippleButton>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  aria-label="Tutup"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
