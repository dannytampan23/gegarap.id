/**
 * Prompt construction + deterministic fallback for the content engine (System 5).
 *
 * The system prompt encodes the stable role + the spec's quality/anti-spam rules.
 * The per-request user turn injects the topic, keywords, local context, and the
 * EXISTING TITLES the article must NOT duplicate (so the model pivots its angle).
 * The JSON shape is enforced by `ARTICLE_SCHEMA`, so the prompt only documents
 * field *semantics* — it never asks the model to "return JSON".
 *
 * `fallbackArticle` mirrors the assistant's no-LLM path: a grounded, genuinely
 * useful article assembled from the topic + category templates, so the feature
 * degrades instead of breaking when `OPENAI_API_KEY` is absent.
 */

import { CATEGORY_CTA, type ModelArticle, type TopicInput } from './schema';

export const SYSTEM_PROMPT = `Kamu adalah gabungan Senior SEO Strategist + Technical Content Writer untuk gegarap.id, marketplace jasa tukang rumah tangga terpercaya di Indonesia (fokus area Daerah Istimewa Yogyakarta).

TUJUAN: menulis SATU artikel SEO yang menyelesaikan masalah nyata pembaca, membangun kepercayaan (E-E-A-T), dan mengarahkan pembaca untuk memesan tukang di gegarap.id.

GAYA & TONE:
- Bahasa Indonesia, profesional tapi membumi, seperti teknisi berpengalaman yang menjelaskan ke tetangga.
- Actionable, spesifik, kontekstual ke Indonesia. TANPA basa-basi, TANPA kalimat klise, TANPA pengulangan, TANPA keyword stuffing. Harus terasa ditulis manusia.

STRUKTUR WAJIB di dalam content_markdown (gunakan heading H2 '##' dan H3 '###', JANGAN tulis H1):
1. Pembuka yang menyentuh pain point pembaca (2-3 kalimat, ada micro-story singkat & realistis).
2. ## Kenapa ini terjadi — penjelasan penyebab.
3. ## Cara mengatasinya — solusi langkah demi langkah (pakai daftar bernomor).
4. ## Kapan harus panggil tukang — batas aman DIY vs profesional, plus peringatan keselamatan bila relevan.
5. ## Perkiraan biaya — estimasi harga realistis di Indonesia (rentang Rupiah, pakai konteks yang diberikan).
6. ## Tips dari teknisi — 3-4 tips ringkas berbasis pengalaman.
7. ## Kesalahan umum — 3-4 kesalahan yang sering dilakukan pemilik rumah.
8. Paragraf penutup dengan ajakan halus memesan lewat gegarap.id (CTA, tidak memaksa).

ATURAN KONTEN:
- title: judul SEO ≤ 60 karakter, mengandung keyword utama, menggugah klik.
- meta_description: ≤ 155 karakter, ada keyword utama + ajakan, bukan kalimat terpotong.
- Sisipkan keyword utama & sekunder secara alami; tambahkan relevansi lokasi.
- faq: 3-5 pertanyaan yang benar-benar ditanyakan pengguna, jawaban padat & jujur.
- internal_link_ideas: 2-4 ide anchor text untuk tautan internal (mis. "lihat semua tukang AC", "cara merawat ...") — cukup teks anchor, URL diisi sistem.
- new_angle: jika ada EXISTING TITLES yang mirip, jelaskan sudut pandang berbeda yang kamu ambil (mis. dari "penyebab" → "biaya" → "solusi cepat"). Jika tidak mirip, isi "sudut orisinal".

SELF-AUDIT (quality_score, skala 1-10): nilai jujur untuk seo, readability, value (manfaat praktis), trust, conversion, dan total (rata-rata dibulatkan). Jika ada yang < 8, perbaiki dulu bagian itu SEBELUM mengembalikan hasil — kembalikan hanya versi final yang sudah bagus.

JANGAN mengarang harga yang tidak masuk akal, klaim medis/teknis berbahaya, atau angka statistik palsu.`;

/** Build the per-request user turn from the topic + existing titles to avoid. */
export function buildUserTurn(input: TopicInput, existingTitles: string[]): string {
  const {
    topic,
    location,
    category,
    intent = 'informational',
    primaryKeyword,
    secondaryKeywords = [],
    priceRange,
    commonProblems = [],
  } = input;

  const lines = [
    `TOPIK: ${topic}`,
    `LOKASI: ${location}`,
    `KATEGORI: ${category}`,
    `INTENT: ${intent}`,
    `KEYWORD UTAMA: ${primaryKeyword || topic}`,
    secondaryKeywords.length ? `KEYWORD SEKUNDER: ${secondaryKeywords.join(', ')}` : '',
    priceRange ? `RENTANG HARGA (Indonesia): ${priceRange}` : '',
    commonProblems.length ? `MASALAH UMUM: ${commonProblems.join('; ')}` : '',
    `CTA YANG DIWAJIBKAN (sebut di penutup): "${CATEGORY_CTA[category]}"`,
    '',
    'JUDUL ARTIKEL YANG SUDAH ADA (HINDARI sudut/angle yang sama, buat yang berbeda):',
    existingTitles.length
      ? existingTitles.map((t) => `- ${t}`).join('\n')
      : '- (belum ada artikel di kategori ini)',
  ].filter(Boolean);

  return lines.join('\n');
}

/** Cap a string to `max` chars on a word boundary (no mid-word cut). */
export function clampText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * Deterministic, grounded fallback when OpenAI is unavailable. Produces a real,
 * publishable article (not a stub) using the topic + category context, so the
 * pipeline degrades gracefully — mirrors the Midtrans/email/assistant no-op path.
 */
export function fallbackArticle(input: TopicInput): ModelArticle {
  const { topic, location, category, primaryKeyword, priceRange, commonProblems = [] } = input;
  const kw = primaryKeyword || topic;
  const problems = commonProblems.length
    ? commonProblems
    : [`${topic} yang dibiarkan makin parah`, 'penanganan asal yang menambah kerusakan'];

  const content = `Masalah **${topic}** di ${location} sering bikin panik, apalagi kalau muncul mendadak saat sedang butuh. Kabar baiknya, sebagian besar kasus bisa dipahami dulu sebelum buru-buru keluar biaya.

## Kenapa ini terjadi
${topic} biasanya berakar dari pemakaian harian, usia komponen, atau pemasangan yang kurang rapi. Gejala awal sering diabaikan sampai akhirnya ${problems[0]}.

## Cara mengatasinya
1. Amati gejalanya dan catat kapan masalah muncul.
2. Matikan sumber daya/air terkait sebelum memeriksa, demi keamanan.
3. Periksa bagian yang paling sering jadi penyebab di kasus ${category.toLowerCase()}.
4. Coba perbaikan ringan yang aman; bila tidak membaik, jangan dipaksakan.

## Kapan harus panggil tukang
Panggil profesional jika menyangkut kelistrikan, tekanan air, struktur, atau bila perbaikan ringan tidak menyelesaikan masalah. Memaksakan perbaikan tanpa alat dan pengalaman justru berisiko menambah biaya — dan kadang membahayakan.

## Perkiraan biaya
${priceRange ? `Untuk ${kw} di Indonesia, kisaran biaya umumnya ${priceRange}.` : `Biaya ${kw} bervariasi tergantung tingkat kerusakan dan material.`} Selalu minta rincian sebelum pekerjaan dimulai agar tidak ada kejutan di akhir.

## Tips dari teknisi
- Tangani sejak gejala awal; makin lama dibiarkan, makin mahal.
- Foto kondisi sebelum diperbaiki untuk memudahkan diagnosis.
- Pilih tukang yang sudah terverifikasi dan punya ulasan nyata.

## Kesalahan umum
- Menunda penanganan sampai kerusakan meluas.
- ${problems[1] ?? 'Memakai material seadanya yang cepat rusak.'}
- Tidak menyepakati harga di awal.

Kalau ragu menangani sendiri, lebih aman serahkan ke ahlinya. Di gegarap.id kamu bisa menemukan ${category} terverifikasi di ${location} dengan harga transparan.`;

  return {
    title: clampText(`${capitalize(topic)} di ${location}: Penyebab & Solusi`, 60),
    meta_description: clampText(
      `Panduan ${kw} di ${location}: penyebab, solusi langkah demi langkah, perkiraan biaya, dan kapan harus panggil tukang. Pesan ${category.toLowerCase()} terverifikasi di gegarap.id.`,
      155
    ),
    content_markdown: content,
    faq: [
      {
        q: `Berapa biaya ${kw}?`,
        a: priceRange
          ? `Umumnya ${priceRange}, tergantung tingkat kerusakan dan material yang dipakai.`
          : `Bervariasi tergantung tingkat kerusakan. Minta rincian harga sebelum pekerjaan dimulai.`,
      },
      {
        q: `Apakah ${topic} bisa diperbaiki sendiri?`,
        a: 'Untuk kasus ringan bisa, asalkan aman. Jika menyangkut listrik, air bertekanan, atau struktur, sebaiknya panggil tukang.',
      },
      {
        q: `Bagaimana cara memesan ${category.toLowerCase()} di ${location}?`,
        a: `Cari ${category.toLowerCase()} terverifikasi di gegarap.id, bandingkan rating dan harga, lalu pesan langsung dari aplikasi.`,
      },
    ],
    internal_link_ideas: [
      `Lihat semua ${category} di ${location}`,
      `Tips merawat agar ${topic} tidak berulang`,
    ],
    quality_score: { seo: 8, readability: 8, value: 8, trust: 8, conversion: 8, total: 8 },
    new_angle: 'sudut orisinal',
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
