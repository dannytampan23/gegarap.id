import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

/**
 * next-auth/react stubs so client components that call useSession render under
 * jsdom without a real session. SessionProvider returns its children directly —
 * typed as `unknown` (not React.ReactNode) because importing React types here
 * trips the Vitest runner.
 */
vi.mock('next-auth/react', () => ({
  __esModule: true,
  useSession: () => ({ data: null, status: 'unauthenticated', update: vi.fn() }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: unknown }) => children,
}));
