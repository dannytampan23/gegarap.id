/**
 * Central place for brand-level constants and support-contact details referenced
 * across pages (footer, legal pages, WhatsApp links, support forms).
 *
 * Contact channels are sourced from env (NEXT_PUBLIC_*) so they are NEVER
 * hardcoded. Known placeholder values are treated as "not configured" → null, so
 * a misconfig degrades gracefully (the CTA hides) instead of linking users to a
 * dead number/inbox. The production build rejects configured placeholders and
 * invalid values, while absent channels remain hidden — see scripts/check-env.mjs.
 */

/** Values that must never reach users — keep in sync with scripts/check-env.mjs. */
const CONTACT_PLACEHOLDERS = new Set([
  '6281234567890',
  'support@gegarap.id',
  'privacy@gegarap.id',
]);

/** Trim and reject empty/placeholder values → null so the UI can fall back safely. */
function realValue(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v || CONTACT_PLACEHOLDERS.has(v)) return null;
  return v;
}

const contact = {
  /** WhatsApp support number, international format (no +, no leading 0). */
  wa: realValue(process.env.NEXT_PUBLIC_WA_SUPPORT),
  /** General support inbox. */
  email: realValue(process.env.NEXT_PUBLIC_EMAIL_SUPPORT),
  /** Privacy/data-rights inbox. Falls back to general support when unset. */
  privacy: realValue(process.env.NEXT_PUBLIC_EMAIL_PRIVACY),
};

export const SITE = {
  name: 'gegarap.id',
  area: 'Daerah Istimewa Yogyakarta',
  /** Flat platform fee (Rupiah) taken by gegarap.id per completed job. */
  platformFee: 20_000,
  /** Minimum down payment (Rupiah) required to confirm a booking. */
  minimumDp: 20_000,

  /** Support channels — each may be null; gate any CTA on its presence. */
  contact,
  /** Privacy contact, falling back to general support so legal pages always resolve. */
  privacyEmail: contact.privacy ?? contact.email,
  /** True when at least one real support channel exists — use to show/hide CTAs. */
  hasSupport: Boolean(contact.wa || contact.email),
} as const;
