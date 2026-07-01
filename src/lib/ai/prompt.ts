/**
 * Prompt construction + output contract for the AI assistant (System 4).
 *
 * The system prompt holds the stable role/instructions; the retrieved provider
 * shortlist is injected into the user turn (it varies per request). The JSON
 * shape is enforced structurally via `RECOMMENDATION_SCHEMA` (Anthropic
 * structured outputs) so we never hand-parse free-form text — the schema is the
 * source of truth and the system prompt only documents field semantics.
 */

import type { SearchedProvider } from './search';

export interface ChatRecommendationItem {
  id: string;
  nama: string;
  layanan: string;
  estimasi_harga: string;
  rating: string;
  alasan: string;
  highlight: string;
}

export interface ChatRecommendation {
  pesan: string;
  rekomendasi: ChatRecommendationItem[];
  catatan: string;
  cta: string;
}

/** JSON Schema for Anthropic structured outputs (output_config.format). */
export const RECOMMENDATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pesan: { type: 'string' },
    rekomendasi: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          nama: { type: 'string' },
          layanan: { type: 'string' },
          estimasi_harga: { type: 'string' },
          rating: { type: 'string' },
          alasan: { type: 'string' },
          highlight: { type: 'string' },
        },
        required: ['id', 'nama', 'layanan', 'estimasi_harga', 'rating', 'alasan', 'highlight'],
      },
    },
    catatan: { type: 'string' },
    cta: { type: 'string' },
  },
  required: ['pesan', 'rekomendasi', 'catatan', 'cta'],
} as const;

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export const SYSTEM_PROMPT = `Kamu adalah asisten AI dari gegarap.id, platform jasa tukang terpercaya di Daerah Istimewa Yogyakarta.
Kamu mengobrol dengan pengguna seperti teman yang paham urusan rumah — ramah, santai, tapi tetap profesional.

GAYA BICARA:
- Bahasa Indonesia sehari-hari yang natural. Jangan kaku atau terdengar seperti robot.
- Kalimat pendek. Pecah balasan jadi beberapa baris kecil (pakai baris baru), seperti chat — bukan artikel.
- Satu ide per baris. Boleh pakai emoji secukupnya (mis. 👍 ➡️) supaya terasa hangat, jangan berlebihan.
- Ringkas. Jangan menjelaskan semuanya sekaligus.

CARA MEMBANTU (bertahap):
- Kalau masalahnya masih umum atau kurang jelas, JANGAN langsung memberi solusi panjang atau rekomendasi tukang.
- Pahami dulu masalahnya. Ajukan SATU pertanyaan lanjutan yang paling penting.
- Konfirmasi pemahamanmu dengan singkat sebelum lanjut ("Oke, jadi ...?").
- Beri informasi sedikit demi sedikit mengikuti jawaban pengguna.
- Tuntun pengguna langkah demi langkah.

KAPAN MEREKOMENDASIKAN TUKANG:
- Sarankan tukang secara natural, TIDAK memaksa — hanya setelah cukup paham kebutuhannya (jenis pekerjaan + lokasi), atau saat pengguna memang minta dicarikan.
- Selama masih menggali masalah, biarkan "rekomendasi" sebagai array KOSONG dan lanjutkan mengobrol.
- Saat merekomendasikan: MAKSIMAL 3 tukang, HANYA dari DATA TUKANG yang diberikan.

ATURAN DATA (wajib):
- Pakai HANYA "id" tukang yang ada di data. JANGAN mengarang tukang, harga, rating, atau detail apa pun.
- "estimasi_harga" dan "rating" disalin apa adanya dari data.
- "alasan": 1 kalimat spesifik kenapa tukang ini cocok. "highlight": maksimal 5 kata.
- Jika pengguna minta rekomendasi tetapi data tukang kosong, jujur bilang belum ada yang cocok dan ajak melonggarkan lokasi/budget.

FORMAT OUTPUT (JSON, sudah dipandu skema — selalu isi keempat field):
- "pesan": balasan obrolanmu. Boleh beberapa baris pendek, dan boleh diakhiri satu pertanyaan lanjutan.
- "rekomendasi": daftar tukang. Kosongkan ([]) selama belum saatnya merekomendasikan.
- "catatan": tips singkat opsional (boleh string kosong).
- "cta": ajakan lembut ke langkah berikutnya, santai dan tidak agresif (boleh string kosong saat masih menggali masalah).`;

/** Build the per-request user turn: provider context + the user's question. */
export function buildUserTurn(query: string, providers: SearchedProvider[]): string {
  const context =
    providers.length === 0
      ? '(tidak ada tukang yang cocok dengan kriteria)'
      : providers
          .map(
            (p, i) =>
              `[Tukang ${i + 1}]\n` +
              `id: ${p.id}\n` +
              `Nama: ${p.name}\n` +
              `Layanan: ${[p.category, ...p.categories.filter((c) => c !== p.category)].join(', ')}\n` +
              `Area: ${p.districts.join(', ') || '-'}\n` +
              `Rating: ${p.rating.toFixed(1)}/5 (${p.ratingCount} ulasan)\n` +
              `Tarif harian: ${rp(p.dailyRate)}\n` +
              `Pekerjaan selesai: ${p.completedJobs}\n` +
              (p.fraudBadge === 'baru' ? `Catatan: tukang baru bergabung\n` : '') +
              (p.bio ? `Bio: ${p.bio}\n` : ''),
          )
          .join('\n');

  return `DATA TUKANG TERSEDIA:\n${context}\n\nPERMINTAAN PENGGUNA:\n"${query}"`;
}

/**
 * Deterministic fallback used when Claude is unavailable (no API key, or an
 * error). Still returns a useful, grounded result from the RAG shortlist so the
 * feature degrades instead of breaking — mirrors the Midtrans/email no-op pattern.
 */
export function fallbackRecommendation(
  query: string,
  providers: SearchedProvider[]
): ChatRecommendation {
  if (providers.length === 0) {
    return {
      pesan:
        'Maaf, belum ada tukang yang cocok dengan kriteria itu. Coba longgarkan lokasi atau budget, ya.',
      rekomendasi: [],
      catatan: 'Kamu juga bisa menelusuri semua tukang lewat halaman pencarian.',
      cta: 'Mau saya bantu carikan dengan kriteria yang berbeda?',
    };
  }

  const top = providers.slice(0, 3);
  return {
    pesan: `Berikut ${top.length} tukang terverifikasi yang paling sesuai untukmu:`,
    rekomendasi: top.map((p) => ({
      id: p.id,
      nama: p.name,
      layanan: p.category,
      estimasi_harga: `${rp(p.dailyRate)} / hari`,
      rating: `${p.rating.toFixed(1)}/5`,
      alasan:
        `${p.name} berpengalaman di ${p.category.toLowerCase()} dengan rating ${p.rating.toFixed(1)} dari ${p.ratingCount} ulasan` +
        (p.districts.length ? ` dan melayani area ${p.districts.slice(0, 2).join(', ')}.` : '.'),
      highlight: p.completedJobs > 0 ? `${p.completedJobs} pekerjaan selesai` : 'Terverifikasi KYC',
    })),
    catatan: 'Harga akhir bisa berbeda tergantung detail pekerjaan.',
    cta: 'Mau saya bantu hubungkan dengan salah satu tukang di atas?',
  };
}
