/** Simple, friendly "tukang" spot illustration for empty states. Uses brand
 *  tokens so it adapts to the theme; decorative only (aria-hidden). */
export function TukangIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 140"
      role="img"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ground shadow */}
      <ellipse cx="80" cy="124" rx="52" ry="8" className="fill-primary/10" />

      {/* toolbox body */}
      <rect x="40" y="78" width="80" height="40" rx="8" className="fill-primary" />
      <rect x="40" y="78" width="80" height="12" rx="6" className="fill-primary-hover" />
      {/* toolbox latch */}
      <rect x="72" y="84" width="16" height="7" rx="2" className="fill-primary-foreground/80" />
      {/* toolbox handle */}
      <path
        d="M58 78v-6a22 22 0 0 1 44 0v6"
        className="fill-none stroke-primary"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* wrench */}
      <g className="stroke-foreground/70" strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M96 60l18-18" />
      </g>
      <circle cx="116" cy="40" r="9" className="fill-amber-400" />
      <circle cx="116" cy="40" r="3.5" className="fill-card" />

      {/* hard hat */}
      <path d="M30 58a20 20 0 0 1 40 0" className="fill-amber-400" />
      <rect x="24" y="56" width="52" height="7" rx="3.5" className="fill-amber-500" />
      <rect x="46" y="36" width="8" height="14" rx="3" className="fill-amber-500" />
    </svg>
  );
}
