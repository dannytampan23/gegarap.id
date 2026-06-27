/**
 * Lightweight intent extraction (System 4). Pulls structured filters — kota
 * (kecamatan), layanan (category), and budget — out of a free-form Indonesian
 * message so the RAG search can pre-filter ProviderProfile rows before keyword
 * matching. Heuristic and dependency-free; the LLM still does the final ranking
 * over whatever this returns.
 */

import { PROVIDER_CATEGORIES, DISTRICTS } from '@/lib/validations';

export interface ExtractedFilters {
  /** Kecamatan name exactly as stored in ProviderProfile.districts. */
  kota?: string;
  /** Canonical category from PROVIDER_CATEGORIES. */
  layanan?: string;
  /** Upper budget bound in whole Rupiah. */
  budgetMax?: number;
}

/** Keyword → canonical category. First hit wins. */
const CATEGORY_KEYWORDS: Array<[RegExp, (typeof PROVIDER_CATEGORIES)[number]]> = [
  [/ledeng|pipa|paralon|krans?|keran|wastafel|saluran air|mampet|bocor air|sumur|pompa air/i, 'Tukang Ledeng'],
  [/listrik|lampu|instalasi|korslet|kabel|stop ?kontak|saklar|mcb|meteran|setrum/i, 'Tukang Listrik'],
  [/bersih|cleaning|kebersihan|nyapu|ngepel|cuci|beberes|asisten rumah/i, 'Pembersih Rumah'],
  [/kebun|taman|rumput|tanaman|pohon|berkebun|potong rumput|landscap/i, 'Tukang Kebun'],
  [/bangun|renovasi|tembok|dinding|cat|atap|plafon|keramik|semen|cor|kusen|pasang/i, 'Tukang Bangunan'],
];

/** Parse a budget figure with Indonesian shorthand (ribu/rb/k, juta/jt). */
function parseBudget(message: string): number | undefined {
  const text = message.toLowerCase();

  // "200 ribu" | "200rb" | "200k" | "1,5 juta" | "1.5jt"
  const scaled = text.match(/(\d+(?:[.,]\d+)?)\s*(juta|jt|ribu|rb|k)\b/);
  if (scaled) {
    const n = parseFloat(scaled[1].replace(',', '.'));
    const unit = scaled[2];
    const mult = unit === 'juta' || unit === 'jt' ? 1_000_000 : 1_000;
    if (Number.isFinite(n)) return Math.round(n * mult);
  }

  // Plain "Rp 200.000" | "200000" — require ≥ 5 digits so we don't catch "2 orang".
  const plain = text.match(/(?:rp\.?\s*)?(\d{1,3}(?:[.\s]\d{3})+|\d{5,})/);
  if (plain) {
    const n = parseInt(plain[1].replace(/[.\s]/g, ''), 10);
    if (Number.isFinite(n) && n >= 10_000) return n;
  }
  return undefined;
}

export function extractFilters(message: string): ExtractedFilters {
  const filters: ExtractedFilters = {};

  const kota = DISTRICTS.find((d) => new RegExp(`\\b${d}\\b`, 'i').test(message));
  if (kota) filters.kota = kota;

  for (const [re, category] of CATEGORY_KEYWORDS) {
    if (re.test(message)) {
      filters.layanan = category;
      break;
    }
  }

  const budgetMax = parseBudget(message);
  if (budgetMax) filters.budgetMax = budgetMax;

  return filters;
}
