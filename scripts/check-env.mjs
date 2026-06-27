/**
 * Build-time guard: refuse to build with placeholder / missing support contact.
 *
 * Wired as the npm `prebuild` step, so a deploy (Vercel injects env into
 * process.env) HARD-FAILS before `next build` if any support channel is absent
 * or still the placeholder value. This is the enforcement half of the safe
 * fallback in src/lib/site.ts — together they guarantee users never see a dead
 * support link in production.
 *
 * Escape hatch for local production builds: set ALLOW_PLACEHOLDER_CONTACT=1.
 * Note: this plain Node process does not auto-load .env files — on Vercel the
 * vars are already in the environment; locally, export them or use the hatch.
 */

const PLACEHOLDERS = new Set([
  '6281234567890',
  'support@gegarap.id',
  'privacy@gegarap.id',
]);

/** field → [envVar, format validator] */
const CHECKS = {
  'WhatsApp support': ['NEXT_PUBLIC_WA_SUPPORT', (v) => /^62\d{7,15}$/.test(v) || 'must be intl format starting 62 (no +, no leading 0)'],
  'Support email': ['NEXT_PUBLIC_EMAIL_SUPPORT', (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || 'must be a valid email'],
  'Privacy email': ['NEXT_PUBLIC_EMAIL_PRIVACY', (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || 'must be a valid email'],
};

if (process.env.ALLOW_PLACEHOLDER_CONTACT) {
  console.warn('⚠️  ALLOW_PLACEHOLDER_CONTACT set — skipping support-contact build guard.');
  process.exit(0);
}

const failures = [];
for (const [label, [envVar, validate]] of Object.entries(CHECKS)) {
  const raw = process.env[envVar]?.trim();
  if (!raw) {
    failures.push(`${label} (${envVar}): missing`);
    continue;
  }
  if (PLACEHOLDERS.has(raw)) {
    failures.push(`${label} (${envVar}): still the placeholder value "${raw}"`);
    continue;
  }
  const ok = validate(raw);
  if (ok !== true) failures.push(`${label} (${envVar}): ${ok}`);
}

if (failures.length > 0) {
  console.error('\n❌ Build blocked — support contact is not production-ready:\n');
  for (const f of failures) console.error(`   • ${f}`);
  console.error('\n   Set real values in the environment, or ALLOW_PLACEHOLDER_CONTACT=1 to bypass locally.\n');
  process.exit(1);
}

console.log('✅ Support contact env validated.');
