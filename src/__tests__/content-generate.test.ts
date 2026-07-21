import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateArticle } from '@/lib/ai/content/generate';
import { CATEGORY_CTA, TITLE_MAX, META_MAX } from '@/lib/ai/content/schema';

const baseInput = {
  topic: 'AC tidak dingin',
  location: 'Yogyakarta',
  category: 'Tukang Listrik' as const,
  primaryKeyword: 'service AC',
  priceRange: 'Rp 50.000 – Rp 350.000',
  commonProblems: ['freon habis', 'filter kotor'],
};

describe('generateArticle (fallback grounding)', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('menghasilkan artikel siap terbit dengan struktur lengkap', async () => {
    const { article, slug, generatedBy } = await generateArticle(baseInput);
    expect(generatedBy).toBe('fallback');
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(article.content_markdown).toContain('## ');
    expect(article.faq.length).toBeGreaterThanOrEqual(3);
    expect(article.faq.length).toBeLessThanOrEqual(5);
  });

  it('menegakkan batas panjang title & meta', async () => {
    const { article } = await generateArticle(baseInput);
    expect(article.title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(article.meta_description.length).toBeLessThanOrEqual(META_MAX);
  });

  it('menyisipkan CTA dinamis sesuai kategori bila model tidak menyertakannya', async () => {
    const { article } = await generateArticle(baseInput);
    expect(article.content_markdown).toContain(CATEGORY_CTA['Tukang Listrik']);
  });

  it('internal_links di-ground ke route nyata (bukan halusinasi)', async () => {
    const { article } = await generateArticle(baseInput);
    expect(article.internal_links[0].href).toBe('/search?category=Tukang%20Listrik');
    for (const l of article.internal_links) {
      expect(l.href.startsWith('/')).toBe(true);
    }
  });

  it('mengisi duplicate_check + total skor adalah rata-rata kriteria', async () => {
    const existingTitles = ['AC Tidak Dingin di Yogyakarta: Penyebab & Solusi'];
    const { article } = await generateArticle({ ...baseInput, existingTitles });
    expect(article.duplicate_check.similarity_score).toBeGreaterThan(0.7);
    expect(article.duplicate_check.is_duplicate).toBe(true);

    const q = article.quality_score;
    const expectedTotal = Math.round((q.seo + q.readability + q.value + q.trust + q.conversion) / 5);
    expect(q.total).toBe(expectedTotal);
  });
});
