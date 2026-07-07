/**
 * Next.js instrumentation hook (PROMPT MASTER Bagian 10).
 *
 * Activates Sentry ONLY when it's both installed (`npm i @sentry/nextjs`) and
 * configured (`SENTRY_DSN` set). The import uses a computed specifier + a guard
 * so the build never fails when the package is absent — until then `lib/sentry`
 * stays a no-op and the structured logger is the only sink.
 */
export async function register(): Promise<void> {
  if (!process.env.SENTRY_DSN) return;

  try {
    // Computed specifier keeps the bundler from hard-resolving an optional dep.
    const moduleName = ['@sentry', 'nextjs'].join('/');
    const Sentry = (await import(/* webpackIgnore: true */ moduleName)) as {
      init: (opts: Record<string, unknown>) => void;
      captureException: (e: unknown, ctx?: unknown) => void;
      captureMessage: (m: string, ctx?: unknown) => void;
    };

    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    });

    const { registerSentry } = await import('@/lib/sentry');
    registerSentry({
      captureException: (e, ctx) => Sentry.captureException(e, ctx as unknown),
      captureMessage: (m, ctx) => Sentry.captureMessage(m, ctx as unknown),
    });

  } catch {
    // @sentry/nextjs not installed — silently stay on the logger-only path.
  }
}
