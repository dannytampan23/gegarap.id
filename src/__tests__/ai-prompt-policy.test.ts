import { describe, expect, it } from 'vitest';
import {
  SYSTEM_PROMPT,
  fallbackRecommendation,
  type ChatRecommendation,
} from '@/lib/ai/prompt';
import type { SearchedProvider } from '@/lib/ai/search';

const provider: SearchedProvider = {
  id: 'provider-1',
  name: 'Budi Teknik',
  category: 'Tukang Listrik',
  categories: ['Tukang Listrik'],
  districts: ['Sleman'],
  dailyRate: 250_000,
  rating: 4.8,
  ratingCount: 12,
  completedJobs: 18,
  bio: null,
  avatarUrl: null,
  fraudBadge: null,
};

function expectNoRecommendation(result: ChatRecommendation) {
  expect(result.rekomendasi).toEqual([]);
  expect(result.cta).toBe('');
}

describe('AI assistant grounding policy', () => {
  it('keeps the anti-hallucination and safety rules in the system prompt', () => {
    expect(SYSTEM_PROMPT).toContain('Informasi tersebut belum tersedia di basis pengetahuan kami.');
    expect(SYSTEM_PROMPT).toContain('Jangan mengarang');
    expect(SYSTEM_PROMPT).toContain('Selalu diagnosa dulu');
    expect(SYSTEM_PROMPT).toContain('inspeksi profesional');
    expect(SYSTEM_PROMPT).toContain('Jangan rekomendasikan kompetitor');
  });

  it('uses the required knowledge-base-unavailable message when no provider context exists', () => {
    const result = fallbackRecommendation('carikan tukang listrik di Sleman', []);

    expect(result.pesan).toContain('Informasi tersebut belum tersedia di basis pengetahuan kami.');
    expectNoRecommendation(result);
  });

  it('diagnoses first for safety-sensitive problems instead of recommending immediately', () => {
    const result = fallbackRecommendation('stop kontak korsleting dan ada bau terbakar', [provider]);

    expect(result.pesan).toContain('Saya belum memiliki informasi yang cukup.');
    expect(result.pesan).toContain('inspeksi profesional');
    expectNoRecommendation(result);
  });

  it('does not recommend providers until the user shows hiring intent', () => {
    const result = fallbackRecommendation('lampu kamar sering kedip', [provider]);

    expect(result.pesan).toContain('Bisa ceritakan gejala utamanya dulu?');
    expectNoRecommendation(result);
  });

  it('recommends only available provider ids when the user asks to be connected', () => {
    const result = fallbackRecommendation('carikan tukang listrik di Sleman', [provider]);

    expect(result.rekomendasi).toHaveLength(1);
    expect(result.rekomendasi[0].id).toBe(provider.id);
    expect(result.rekomendasi[0].nama).toBe(provider.name);
  });
});
