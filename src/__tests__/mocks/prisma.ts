import { beforeEach, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

/**
 * Deep mock of the Prisma client, wired as a Vitest SETUP file.
 *
 * Registering `vi.mock('@/lib/prisma')` here (not in an imported helper)
 * guarantees it runs before any route module loads, so handlers pick up the mock
 * instead of the real pg-backed client. `@/lib/prisma` is a DEFAULT export, so
 * the mock must expose `default`. Tests can import { mockPrisma } to set up
 * return values.
 */
export const mockPrisma = mockDeep<PrismaClient>();

vi.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

beforeEach(() => {
  mockReset(mockPrisma);
});
