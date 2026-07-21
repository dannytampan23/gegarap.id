import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPrisma } from './mocks/prisma';

vi.mock('@/lib/firebase/session', () => ({
  getSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/rate-limit', () => ({
  clientIp: vi.fn(() => '127.0.0.1'),
  durableRateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 19, retryAfter: 0 }),
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock('@/lib/ai/search', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/search')>('@/lib/ai/search');
  return {
    ...actual,
    searchProviders: vi.fn(),
  };
});

import { cacheGet, cacheSet } from '@/lib/cache';
import { searchProviders, type SearchedProvider } from '@/lib/ai/search';
import { POST } from '@/app/api/ai/chat/route';

const provider: SearchedProvider = {
  id: 'provider-1',
  name: 'Budi Teknik',
  category: 'Tukang Listrik',
  categories: ['Tukang Listrik'],
  districts: ['Depok'],
  dailyRate: 250_000,
  rating: 4.8,
  ratingCount: 12,
  completedJobs: 18,
  bio: null,
  avatarUrl: null,
  fraudBadge: null,
};

function chatRequest(body: unknown) {
  return new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/ai/chat route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(cacheSet).mockResolvedValue(undefined);
    vi.mocked(searchProviders).mockResolvedValue([provider]);
    mockPrisma.chatSession.create.mockResolvedValue({ id: 'session-1' } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns deterministic fallback with mock=true when OpenAI is not configured', async () => {
    const res = await POST(chatRequest({ message: 'carikan tukang listrik di Depok' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.mock).toBe(true);
    expect(json.data.sessionId).toBe('session-1');
    expect(json.data.rekomendasi[0].id).toBe(provider.id);
    expect(cacheSet).toHaveBeenCalledWith(
      expect.stringMatching(/^ai:chat:/),
      expect.objectContaining({ source: 'fallback' }),
      300
    );
  });

  it('preserves fallback mock flag on cache hit', async () => {
    vi.mocked(cacheGet).mockResolvedValue({
      source: 'fallback',
      providers: [provider],
      recommendation: {
        message: 'cached',
        pesan: 'cached',
        category: 'Tukang Listrik',
        riskLevel: 'low',
        confidenceLevel: 'low',
        bookingEligible: false,
        suggestedNextAction: '',
        rekomendasi: [],
        catatan: '',
        cta: '',
      },
    });

    const res = await POST(chatRequest({ message: 'lampu kedip' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.mock).toBe(true);
    expect(searchProviders).not.toHaveBeenCalled();
  });

  it('preserves OpenAI mock=false flag on cache hit', async () => {
    vi.mocked(cacheGet).mockResolvedValue({
      source: 'openai',
      providers: [],
      recommendation: {
        message: 'cached',
        pesan: 'cached',
        category: 'Tukang Listrik',
        riskLevel: 'low',
        confidenceLevel: 'low',
        bookingEligible: false,
        suggestedNextAction: '',
        rekomendasi: [],
        catatan: '',
        cta: '',
      },
    });

    const res = await POST(chatRequest({ message: 'lampu kedip' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.mock).toBe(false);
    expect(searchProviders).not.toHaveBeenCalled();
  });
});
