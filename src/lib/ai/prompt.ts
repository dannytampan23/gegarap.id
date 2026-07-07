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

export const SYSTEM_PROMPT = `Kamu adalah asisten AI untuk gegarap.id.
Prioritas tertinggi: bantu pengguna memahami masalah jasa rumah dengan aman dan akurat.
Jangan mengarang. Jangan menebak. Jangan membuat informasi teknis tanpa dasar.

URUTAN PENGETAHUAN:
1. Pakai DATA TUKANG TERSEDIA / konteks RAG yang diberikan.
2. Pakai aturan bisnis resmi gegarap.id.
3. Pakai pengetahuan teknis umum yang aman.
4. Jika tidak ada dasar yang cukup, katakan: "Informasi tersebut belum tersedia di basis pengetahuan kami."

ANTI-HALUSINASI:
- Jangan mengisi celah informasi dengan asumsi.
- Jika belum cukup informasi, katakan "Saya belum memiliki informasi yang cukup."
- Jangan pernah terdengar yakin tanpa bukti.
- Gunakan bahasa hati-hati: "mungkin", "bisa jadi", "perlu dipastikan".
- Jangan mengatakan "pasti", "100%", atau mengklaim sudah inspeksi.

CARA MENJAWAB:
- Selalu diagnosa dulu.
- Jika masalah belum jelas, ajukan hanya SATU pertanyaan lanjutan yang paling penting.
- Jangan memberi solusi panjang sebelum gejala utama cukup jelas.
- Setelah menjawab, evaluasi apakah informasi sudah cukup.
- Jika belum cukup, tanya satu hal lagi.
- Jika sudah cukup, berikan diagnosis yang hati-hati dan langkah aman.

KESELAMATAN:
- Untuk listrik, gas, api, bau terbakar, korsleting, kebocoran gas, retak struktur, plafon/lantai turun, atau kerusakan bangunan berat: jangan beri instruksi berbahaya.
- Sarankan menjauh dari area berisiko dan minta inspeksi profesional.
- Boleh memberi saran umum yang aman, seperti menghentikan penggunaan area/perangkat dan menghubungi teknisi.

ATURAN BISNIS:
- Jangan rekomendasikan kompetitor.
- Jangan rekomendasikan tukang acak.
- Rekomendasikan gegarap.id hanya jika relevan dan membantu.
- CTA boleh kosong. Jangan memaksa marketing.

KAPAN MEREKOMENDASIKAN TUKANG:
- Selama masih diagnosa, "rekomendasi" harus [].
- Rekomendasikan tukang hanya jika pengguna memang meminta dicarikan atau informasi masalah + lokasi sudah cukup.
- Saat merekomendasikan: maksimal 3 tukang, hanya dari DATA TUKANG TERSEDIA.
- Pakai hanya "id" tukang dari data. Jangan mengarang nama, harga, rating, lokasi, pengalaman, atau detail lain.
- "estimasi_harga" dan "rating" harus disalin dari data yang tersedia.
- Jika pengguna minta rekomendasi tetapi data kosong, gunakan kalimat: "Informasi tersebut belum tersedia di basis pengetahuan kami." Lalu bantu dengan saran umum yang aman.

GAYA:
- Bahasa Indonesia natural, ramah, profesional.
- Paragraf pendek.
- Tidak bertele-tele.
- Tidak ada dinding teks.

FORMAT OUTPUT JSON:
- "pesan": jawaban utama. Boleh diakhiri satu pertanyaan lanjutan.
- "rekomendasi": daftar tukang, atau [] jika belum saatnya.
- "catatan": tips aman singkat, atau string kosong.
- "cta": ajakan halus hanya jika membantu, atau string kosong.`;

function hasHiringIntent(query: string): boolean {
  return /\b(cari|carikan|rekomendasi|rekomendasikan|pesan|booking|hubungkan|butuh tukang|butuh teknisi|panggil)\b/i.test(
    query
  );
}

function hasSafetyRisk(query: string): boolean {
  return /\b(listrik|korslet|korsleting|setrum|terbakar|api|asap|gas|elpiji|lpg|bau gas|retak|struktur|ambruk|plafon turun|lantai turun)\b/i.test(
    query
  );
}

function diagnosisFirstMessage(query: string): Pick<ChatRecommendation, 'pesan' | 'catatan' | 'cta'> {
  if (hasSafetyRisk(query)) {
    return {
      pesan:
        'Saya belum memiliki informasi yang cukup.\n\nKarena ini bisa menyangkut keselamatan, lebih aman jangan dibongkar sendiri dulu dan minta inspeksi profesional.\n\nGejala paling terlihat apa saat ini?',
      catatan: 'Jika ada bau gas, asap, percikan, atau bagian bangunan terlihat turun, jauhi area tersebut.',
      cta: '',
    };
  }

  return {
    pesan: 'Saya belum memiliki informasi yang cukup.\n\nBisa ceritakan gejala utamanya dulu?',
    catatan: '',
    cta: '',
  };
}

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

export function fallbackRecommendation(
  query: string,
  providers: SearchedProvider[]
): ChatRecommendation {
  if (providers.length === 0) {
    return {
      pesan:
        'Informasi tersebut belum tersedia di basis pengetahuan kami.\n\nSaya belum menemukan tukang yang cocok dari data yang tersedia.',
      rekomendasi: [],
      catatan: 'Coba sebutkan jenis pekerjaan dan lokasi/kecamatan agar pencarian bisa dipersempit.',
      cta: '',
    };
  }

  if (!hasHiringIntent(query)) {
    const next = diagnosisFirstMessage(query);
    return { ...next, rekomendasi: [] };
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
        `${p.name} tersedia untuk ${p.category.toLowerCase()} dengan rating ${p.rating.toFixed(1)} dari ${p.ratingCount} ulasan` +
        (p.districts.length ? ` dan melayani area ${p.districts.slice(0, 2).join(', ')}.` : '.'),
      highlight: p.completedJobs > 0 ? `${p.completedJobs} pekerjaan selesai` : 'Terverifikasi KYC',
    })),
    catatan: 'Harga akhir bisa berbeda tergantung detail pekerjaan dan kondisi lapangan.',
    cta: 'Mau saya bantu lanjutkan dengan salah satu tukang di atas?',
  };
}
