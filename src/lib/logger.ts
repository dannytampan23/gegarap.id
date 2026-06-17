/**
 * Minimal structured logger (PROMPT MASTER Bagian 10). Emits one JSON line per
 * event instead of free-form `console.log`, so logs are queryable and can be
 * tagged with paymentId/bookingId for tracing a transaction. Swap the sink for
 * Sentry/Logtail/Datadog when configured — keep the call sites unchanged.
 */

export type LogLevel = 'info' | 'warn' | 'error';

/** Canonical event names the payment system emits (Bagian 10). */
export type PaymentLogEvent =
  | 'payment.created'
  | 'payment.status_changed'
  | 'webhook.received'
  | 'webhook.verified'
  | 'webhook.signature_invalid'
  | 'webhook.duplicate'
  | 'webhook.anomaly'
  | 'disbursement.executed'
  | 'disbursement.failed'
  | 'refund.requested'
  | 'refund.resolved'
  | 'reconciliation.run'
  | 'reconciliation.healed'
  | 'autorelease.run'
  | 'autocancel.run';

export function logEvent(
  event: PaymentLogEvent | (string & {}),
  data: Record<string, unknown> = {},
  level: LogLevel = 'info'
): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...data });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
  // TODO(Bagian 10): forward `error`/`warn` to Sentry with paymentId/bookingId tags.
}

/**
 * Anomalies that must page ops (Bagian 10). Logged at error level with a stable
 * `alert` tag so an alerting rule can match them.
 */
export function logAlert(alert: string, data: Record<string, unknown> = {}): void {
  logEvent('webhook.anomaly', { alert, ...data }, 'error');
}
