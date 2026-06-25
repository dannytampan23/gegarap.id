/**
 * Shared typed errors (Architecture brief Bagian 2/6). Policy/guard functions
 * throw these instead of returning ad-hoc strings, so they're unit-testable
 * without a DB and `handle()` (lib/api) can map them to the right HTTP status in
 * one place.
 */

export class ForbiddenError extends Error {
  readonly code = 'FORBIDDEN';
  readonly httpStatus = 403;
  constructor(message = 'Akses ditolak.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class InvalidStateError extends Error {
  readonly code = 'INVALID_STATE';
  readonly httpStatus = 409;
  constructor(message = 'Status tidak valid untuk aksi ini.') {
    super(message);
    this.name = 'InvalidStateError';
  }
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  readonly httpStatus = 404;
  constructor(message = 'Data tidak ditemukan.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** A precondition on the request itself failed (missing field, bad input state). */
export class BadRequestError extends Error {
  readonly code = 'BAD_REQUEST';
  readonly httpStatus = 400;
  constructor(message = 'Permintaan tidak valid.') {
    super(message);
    this.name = 'BadRequestError';
  }
}

/** The caller is being throttled (abuse/velocity guard). */
export class RateLimitedError extends Error {
  readonly code = 'RATE_LIMITED';
  readonly httpStatus = 429;
  constructor(message = 'Terlalu banyak permintaan. Coba lagi nanti.') {
    super(message);
    this.name = 'RateLimitedError';
  }
}

/** Any error carrying an httpStatus this layer knows how to surface. */
export interface HttpAwareError extends Error {
  httpStatus: number;
}

export function isHttpAwareError(err: unknown): err is HttpAwareError {
  return (
    err instanceof Error &&
    typeof (err as { httpStatus?: unknown }).httpStatus === 'number'
  );
}
