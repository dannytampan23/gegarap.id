import { describe, it, expect } from 'vitest';
import { titleSimilarity, checkDuplicate, slugify } from '@/lib/ai/content/dedup';
import { buildInternalLinks } from '@/lib/ai/content/links';
import { clampText } from '@/lib/ai/content/prompt';

describe('titleSimilarity', () => {
  it('judul identik → ~1.0', () => {
    expect(titleSimilarity('AC tidak dingin', 'AC tidak dingin')).toBeGreaterThan(0.95);
  });

  it('angle berbeda (penyebab vs biaya) → rendah', () => {
    const s = titleSimilarity(
      'Penyebab AC Tidak Dingin di Rumah',
      'Biaya Service Kulkas Bocor Terbaru'
    );
    expect(s).toBeLessThan(0.5);
  });

  it('reorder + stopword → tetap terdeteksi mirip', () => {
    const s = titleSimilarity('Cara Mengatasi Keran Bocor', 'Mengatasi Keran yang Bocor');
    expect(s).toBeGreaterThan(0.6);
  });
});

describe('checkDuplicate', () => {
  const existing = ['Penyebab AC Tidak Dingin', 'Cara Pasang Stop Kontak Baru'];

  it('judul baru yang mirip > 0.7 → is_duplicate true + nearest', () => {
    const r = checkDuplicate('Penyebab AC Tidak Dingin Lagi', existing);
    expect(r.isDuplicate).toBe(true);
    expect(r.similarityScore).toBeGreaterThan(0.7);
    expect(r.nearest).toBe('Penyebab AC Tidak Dingin');
  });

  it('judul dengan angle berbeda → bukan duplikat', () => {
    const r = checkDuplicate('Estimasi Biaya Bersih Taman Bulanan', existing);
    expect(r.isDuplicate).toBe(false);
    expect(r.similarityScore).toBeLessThanOrEqual(0.7);
  });

  it('tidak ada judul existing → skor 0', () => {
    expect(checkDuplicate('Apa pun', []).similarityScore).toBe(0);
  });
});

describe('slugify', () => {
  it('menghasilkan kebab-case URL-safe', () => {
    expect(slugify('AC Tidak Dingin di Yogyakarta!')).toBe('ac-tidak-dingin-di-yogyakarta');
  });
  it('membuang trailing dash & membatasi panjang', () => {
    const s = slugify('a'.repeat(200));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith('-')).toBe(false);
  });
});

describe('buildInternalLinks (grounded)', () => {
  it('selalu mulai dari halaman pencarian kategori & diakhiri asisten', () => {
    const links = buildInternalLinks({ category: 'Tukang Listrik', selfSlug: 'x', related: [] });
    expect(links[0].href).toBe('/search?category=Tukang%20Listrik');
    expect(links[links.length - 1].href).toBe('/asisten');
  });

  it('menyertakan artikel sekategori, mengecualikan diri sendiri & kategori lain', () => {
    const links = buildInternalLinks({
      category: 'Tukang Listrik',
      selfSlug: 'self',
      related: [
        { slug: 'self', title: 'Diri sendiri', category: 'Tukang Listrik' },
        { slug: 'lain', title: 'Listrik jeglek', category: 'Tukang Listrik' },
        { slug: 'beda', title: 'Pipa bocor', category: 'Tukang Ledeng' },
      ],
    });
    const hrefs = links.map((l) => l.href);
    expect(hrefs).toContain('/artikel/lain');
    expect(hrefs).not.toContain('/artikel/self');
    expect(hrefs).not.toContain('/artikel/beda');
  });

  it('tidak ada href duplikat', () => {
    const links = buildInternalLinks({ category: 'Tukang Kebun', selfSlug: 'x', related: [] });
    expect(new Set(links.map((l) => l.href)).size).toBe(links.length);
  });
});

describe('clampText', () => {
  it('memotong di batas kata, tidak melebihi max', () => {
    const out = clampText('Panduan lengkap mengatasi AC yang tidak dingin sama sekali', 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith(' ')).toBe(false);
  });
  it('teks pendek dikembalikan apa adanya', () => {
    expect(clampText('Singkat', 60)).toBe('Singkat');
  });
});
