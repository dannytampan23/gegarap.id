/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't advertise the framework (tiny header saving + one less fingerprint).
  poweredByHeader: false,
  // Serve modern formats from next/image when a component uses it. AVIF first,
  // WebP fallback — both dramatically smaller than JP/PNG for the same quality.
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Enable the `src/instrumentation.ts` hook (Sentry init, Bagian 10). On
  // Next 14.2 this is still behind an experimental flag (default from 15).
  experimental: {
    // Barrel-import tree-shaking. framer-motion (and lucide-react) re-export
    // hundreds of symbols from a single entry; without this, importing one icon
    // can pull the whole module graph into a route's chunk. This rewrites the
    // imports to their deep paths so only what's used is bundled — smaller
    // client chunks + faster cold compiles. (lucide-react is auto-optimized by
    // Next 14.2, listed here for explicitness alongside framer-motion.)
    optimizePackageImports: ['lucide-react', 'framer-motion'],
    // firebase-admin (and its transitive deps) must NOT be webpack-bundled, or a
    // pure-ESM transitive dep gets require()'d in the Vercel serverless runtime
    // and throws ERR_REQUIRE_ESM. Externalizing leaves it as a native node
    // require from node_modules (nft traces it into the lambda). Fixes every
    // server route that touches Firebase Admin (auth/session/providers/etc.).
  },
  serverExternalPackages: ['firebase-admin'],
  // Security + isolation headers applied to every response.
  //
  // COOP: `same-origin-allow-popups` (not the stricter `same-origin`) so
  // Firebase's Google sign-in popup keeps a handle to its opener — otherwise the
  // browser blocks window.closed/window.close(), spamming COOP warnings and
  // making popup-close detection flaky. This is the value Firebase recommends
  // for OAuth-popup apps.
  //
  // The rest are the standard "Helmet"-equivalent hardening set. Deliberately NO
  // Content-Security-Policy here: a correct CSP for this app has to allowlist
  // Firebase/Google, Midtrans (sandbox + prod), Supabase, and Leaflet tiles, and
  // shipping one blind would break checkout and auth. That belongs in its own
  // staged, report-only-first change. Permissions-Policy only locks down camera
  // and microphone (verified unused); geolocation/payment are left permissive so
  // the map and Midtrans Snap keep working.
  async headers() {
    // Stage 1 of a staged CSP: REPORT-ONLY. It never blocks — browsers only POST
    // violations to /api/csp-report — so it cannot break checkout/auth while we
    // learn what an enforcing policy would reject. Shipped as a plain response
    // header (not an RSC nonce), so it stays compatible with the ISR/static
    // pages. 'unsafe-inline' is intentional for this stage: Next's App Router
    // emits inline bootstrap/hydration scripts and libraries inject inline
    // styles; going nonce-based would force every page dynamic and undo the
    // static caching. Origins allow-listed from actual usage: OpenStreetMap
    // tiles, Supabase (photos/KTP), Google user-content (OAuth avatars),
    // Firebase Auth, and Midtrans Snap (sandbox + prod).
    const useFirebaseEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
    const scriptSrc = [
      'script-src',
      "'self'",
      "'unsafe-inline'",
      ...(useFirebaseEmulator ? ["'unsafe-eval'"] : []),
      'https://apis.google.com',
      'https://app.midtrans.com',
      'https://app.sandbox.midtrans.com',
    ].join(' ');
    const frameSrc = [
      'frame-src',
      "'self'",
      'https://*.firebaseapp.com',
      'https://accounts.google.com',
      'https://app.midtrans.com',
      'https://app.sandbox.midtrans.com',
      ...(useFirebaseEmulator ? ['http://127.0.0.1:9099'] : []),
    ].join(' ');
    const cspReportOnly = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://*.googleusercontent.com https://i.pravatar.cc",
      "font-src 'self' data:",
      "connect-src 'self' https://apis.google.com https://*.googleapis.com https://*.supabase.co https://*.midtrans.com",
      frameSrc,
      "worker-src 'self' blob:",
      'report-uri /api/csp-report',
    ].join('; ');

    const securityHeaders = [
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=()' },
      { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
    ];
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
