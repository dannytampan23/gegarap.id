import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma } from './mocks/prisma';

// The booking service pulls in the fraud guards; mock them so we can drive the
// velocity decision and assert the service's domain preconditions in isolation.
const { checkBookingVelocity, recordDeviceAndCheck } = vi.hoisted(() => ({
  checkBookingVelocity: vi.fn(),
  recordDeviceAndCheck: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/fraud', () => ({
  __esModule: true,
  checkBookingVelocity,
  recordDeviceAndCheck,
  deviceIdFrom: () => 'dev',
}));

import { createBooking } from '@/lib/services/booking';
import { BadRequestError, RateLimitedError } from '@/lib/errors';

const input = {
  providerProfileId: 'prov1',
  description: 'Perbaiki keran bocor',
  customerAddress: 'Jl. Kaliurang KM 5 No. 10',
  district: 'Depok',
  scheduledDate: '2026-07-01',
  timeSlot: 'pagi' as const,
  estimatedDays: 2,
};

describe('createBooking domain guards', () => {
  beforeEach(() => {
    checkBookingVelocity.mockReset();
    recordDeviceAndCheck.mockClear();
  });

  it('requires a WhatsApp number before any DB work', async () => {
    await expect(
      createBooking(input, { id: 'u1', name: 'Budi', phone: null }, 'dev')
    ).rejects.toBeInstanceOf(BadRequestError);
    // Rejected before touching the velocity guard.
    expect(checkBookingVelocity).not.toHaveBeenCalled();
  });

  it('blocks when the unpaid-booking velocity cap is hit', async () => {
    checkBookingVelocity.mockResolvedValue({ blocked: true, activeCount: 3 });
    await expect(
      createBooking(input, { id: 'u1', name: 'Budi', phone: '628111' }, 'dev')
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('rejects an unavailable/unverified provider', async () => {
    checkBookingVelocity.mockResolvedValue({ blocked: false, activeCount: 0 });
    mockPrisma.providerProfile.findUnique.mockResolvedValue(null as never);
    await expect(
      createBooking(input, { id: 'u1', name: 'Budi', phone: '628111' }, 'dev')
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});
