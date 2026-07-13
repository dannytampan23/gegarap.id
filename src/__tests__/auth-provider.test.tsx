import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: firebaseMocks.onAuthStateChanged,
  signOut: firebaseMocks.signOut,
}));

vi.unmock('@/components/providers/AuthProvider');

import { AuthProvider } from '@/components/providers/AuthProvider';

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the authoritative profile from the existing auth endpoint', async () => {
    const user = {
      uid: 'user-1',
      displayName: 'Customer',
      email: 'customer@example.com',
      photoURL: null,
      getIdToken: vi.fn().mockResolvedValue('firebase-token'),
    };

    firebaseMocks.onAuthStateChanged.mockImplementation((_auth, listener) => {
      void listener(user);
      return vi.fn();
    });

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { name: 'Customer', role: 'CUSTOMER' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    render(
      <AuthProvider>
        <div>content</div>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', { cache: 'no-store' });
    });

    expect(fetchMock).not.toHaveBeenCalledWith('/api/me', expect.anything());
  });
});
