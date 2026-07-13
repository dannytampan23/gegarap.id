import { getSession } from '@/lib/firebase/session';
import { ok, fail, handle } from '@/lib/api';
import { bookingSchema } from '@/lib/validations';
import { createBooking } from '@/lib/services/booking';
import { deviceIdFrom } from '@/lib/fraud';
import { enforceDurableRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  return handle(async () => {
    // Booking requires an authenticated session; identity comes from the session,
    // never the request body.
    const session = await getSession();
    if (!session?.user?.id) {
      return fail('Harus login untuk booking.', 401);
    }

    await enforceDurableRateLimit(`booking:create:${session.user.id}`, {
      windowMs: 60 * 60 * 1000,
      max: 10,
    });

    const body = await req.json().catch(() => null);
    if (!body) return fail('Body permintaan tidak valid.', 400);
    const input = bookingSchema.parse(body);

    // Orchestration (velocity guard, fee snapshot, payment token, persistence,
    // provider notification) lives in the booking service. It throws typed errors
    // that `handle()` maps to the right status code.
    const result = await createBooking(
      input,
      {
        id: session.user.id,
        name: session.user.name ?? null,
        phone: session.user.phone ?? null,
        email: session.user.email ?? null,
      },
      deviceIdFrom(req),
      // Idempotency-Key header makes a retried POST safe (no duplicate booking).
      { idempotencyKey: req.headers.get('idempotency-key') }
    );

    return ok(result, 201);
  })();
}
