/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable the `src/instrumentation.ts` hook (Sentry init, Bagian 10). On
  // Next 14.2 this is still behind an experimental flag (default from 15).
  experimental: {
    instrumentationHook: true,
    // firebase-admin (and its transitive deps) must NOT be webpack-bundled, or a
    // pure-ESM transitive dep gets require()'d in the Vercel serverless runtime
    // and throws ERR_REQUIRE_ESM. Externalizing leaves it as a native node
    // require from node_modules (nft traces it into the lambda). Fixes every
    // server route that touches Firebase Admin (auth/session/providers/etc.).
    serverComponentsExternalPackages: ['firebase-admin'],
  },
};

export default nextConfig;
