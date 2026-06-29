/**
 * Duplicate detection for the content engine (System 5).
 *
 * Deliberately embedding-free — same call as the assistant's RAG (keyword over
 * pgvector) so we add no new infra. Title similarity is the MAX of two cheap,
 * complementary signals:
 *   - word-level Jaccard  → catches reordered / synonym-light overlap
 *   - char-trigram Dice   → catches morphological variants ("biaya"/"biayanya")
 * Above SIMILARITY_THRESHOLD the orchestrator asks the model to pivot the angle
 * (penyebab → biaya → solusi cepat), exactly as the spec's DUPLICATE DETECTION
 * step prescribes.
 */

/** Above this, two titles are "the same angle" and we force a pivot. */
export const SIMILARITY_THRESHOLD = 0.7;

/** Indonesian stopwords that add noise to title overlap, not meaning. */
const STOPWORDS = new Set([
  'di',
  'ke',
  'dari',
  'yang',
  'dan',
  'atau',
  'untuk',
  'pada',
  'dengan',
  'cara',
  'tips',
  'panduan',
  'agar',
  'biar',
  'saat',
  'jika',
  'kalau',
  'ini',
  'itu',
  'bisa',
  'dengan',
  'secara',
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contentWords(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(' ')
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of Array.from(a)) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

function trigrams(s: string): Set<string> {
  const t = normalize(s).replace(/\s/g, '');
  const grams = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) grams.add(t.slice(i, i + 3));
  return grams;
}

function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const g of Array.from(a)) if (b.has(g)) inter++;
  return (2 * inter) / (a.size + b.size);
}

/** Similarity of two titles in [0, 1]. */
export function titleSimilarity(a: string, b: string): number {
  const word = jaccard(contentWords(a), contentWords(b));
  const tri = diceCoefficient(trigrams(a), trigrams(b));
  return Math.max(word, tri);
}

export interface DedupResult {
  isDuplicate: boolean;
  similarityScore: number;
  /** The closest existing title, for the prompt's "avoid this angle" hint. */
  nearest: string | null;
}

/** Compare a candidate title against existing ones; round score to 2 dp. */
export function checkDuplicate(candidate: string, existing: string[]): DedupResult {
  let max = 0;
  let nearest: string | null = null;
  for (const e of existing) {
    const s = titleSimilarity(candidate, e);
    if (s > max) {
      max = s;
      nearest = e;
    }
  }
  const score = Math.round(max * 100) / 100;
  return { isDuplicate: score > SIMILARITY_THRESHOLD, similarityScore: score, nearest };
}

/** URL-safe kebab slug from a title; capped so the path stays sane. */
export function slugify(title: string): string {
  return normalize(title).split(' ').join('-').slice(0, 80).replace(/-+$/, '');
}
