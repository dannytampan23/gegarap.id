/**
 * Next.js instrumentation hook (PROMPT MASTER Bagian 10).
 *
 * Activates Sentry when SENTRY_DSN is set. The guarded computed import keeps
 * observability from breaking the app path it is supposed to watch; without a
 * DSN, lib/sentry remains a no-op and structured logs stay as the baseline sink.
 */
export async function register(): Promise<void> {
  if (!process.env.SENTRY_DSN) return;

  try {
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
    // Sentry setup must never break the app path it is observing.
  }
}
