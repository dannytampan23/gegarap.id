'use client';

import { motion } from 'framer-motion';

/**
 * Lightweight enter transition (fade + slide up) for app pages. Used on
 * interactive, non-SEO-critical routes (e.g. /asisten) so the view eases in on
 * navigation. Deliberately NOT applied to SEO article bodies, which must render
 * their content without being gated behind a JS opacity animation.
 */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
