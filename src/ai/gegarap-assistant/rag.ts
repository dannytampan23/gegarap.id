export interface AssistantKnowledgeSnippet {
  id: string;
  title: string;
  categories: string[];
  triggers: string[];
  insight: string;
  safeChecks: string[];
  handoffSignal: string;
  avoid: string;
}

export const ASSISTANT_KNOWLEDGE: readonly AssistantKnowledgeSnippet[] = [
  {
    id: 'ac-cold-airflow',
    title: 'AC kurang dingin',
    categories: ['AC'],
    triggers: ['ac', 'dingin', 'panas', 'angin', 'filter', 'freon', 'outdoor', 'kompresor'],
    insight:
      'Pisahkan dulu masalah airflow dan masalah pendinginan; AC yang anginnya kecil sering berawal dari filter/evaporator kotor, sedangkan angin normal tapi tidak dingin lebih mengarah ke refrigeran, sensor, atau outdoor unit.',
    safeChecks: [
      'Tanya apakah angin indoor masih kencang atau melemah.',
      'Tanya kapan filter terakhir dibersihkan.',
      'Tanya apakah outdoor unit menyala normal dan tidak tertutup barang.',
    ],
    handoffSignal:
      'Sarankan teknisi jika outdoor mati, muncul es, pipa berembun tidak wajar, MCB turun, atau pengguna perlu pengecekan freon.',
    avoid: 'Jangan langsung menyuruh isi freon tanpa gejala pendukung.',
  },
  {
    id: 'electric-trip-pattern',
    title: 'Listrik jeglek atau MCB turun',
    categories: ['Tukang Listrik', 'Listrik'],
    triggers: ['listrik', 'jeglek', 'mcb', 'mati', 'korslet', 'stop kontak', 'pompa', 'nyetrum'],
    insight:
      'Pola jatuhnya MCB lebih penting daripada merek alatnya; turun saat alat tertentu menyala mengarah ke beban/alat itu, sedangkan turun acak atau saat hujan bisa mengarah ke kebocoran arus.',
    safeChecks: [
      'Tanya apakah MCB turun saat alat tertentu dinyalakan.',
      'Tanya apakah ada area basah, bau gosong, panas, atau percikan.',
      'Jika aman, minta pengguna mencabut alat terakhir yang dipakai sebelum mencoba lagi.',
    ],
    handoffSignal:
      'Sarankan teknisi jika ada panas, bau gosong, percikan, stop kontak basah, atau MCB tetap turun setelah beban dilepas.',
    avoid: 'Jangan memberi instruksi bongkar panel, stop kontak, atau kabel.',
  },
  {
    id: 'plumbing-drain-location',
    title: 'Saluran mampet atau air meluap',
    categories: ['Tukang Ledeng', 'Plumbing'],
    triggers: ['mampet', 'saluran', 'got', 'wc', 'toilet', 'air', 'pipa', 'bau', 'meluap'],
    insight:
      'Lokasi mampet menunjukkan skala masalah; satu floor drain yang lambat biasanya lokal, tapi beberapa titik ikut naik berarti sumbatan bisa berada di jalur utama.',
    safeChecks: [
      'Tanya apakah mampet terjadi di satu titik atau beberapa titik sekaligus.',
      'Tanya apakah air balik membawa bau atau kotoran.',
      'Sarankan hentikan pemakaian air di titik terkait sementara.',
    ],
    handoffSignal:
      'Sarankan tukang ledeng jika beberapa titik ikut mampet, air kotor balik, atau pengguna sudah mencoba plunger tanpa hasil.',
    avoid: 'Jangan menyarankan campuran bahan kimia berbahaya.',
  },
  {
    id: 'roof-leak-trace',
    title: 'Atap bocor',
    categories: ['Tukang Atap'],
    triggers: ['atap', 'bocor', 'hujan', 'plafon', 'rembes', 'talang', 'genteng'],
    insight:
      'Titik tetesan di plafon sering bukan titik bocor sebenarnya; air bisa berjalan di rangka, talang, atau sambungan sebelum jatuh di tempat lain.',
    safeChecks: [
      'Tanya apakah bocor muncul saat hujan deras, gerimis lama, atau setelah hujan berhenti.',
      'Tanya apakah dekat talang, dak, sambungan atap, atau tembok luar.',
      'Sarankan foto area basah dari dalam tanpa naik ke atap.',
    ],
    handoffSignal:
      'Sarankan tukang atap jika plafon melendut, bocor dekat instalasi listrik, atau perlu pengecekan di ketinggian.',
    avoid: 'Jangan menyuruh pengguna naik ke atap saat basah atau tanpa alat keselamatan.',
  },
  {
    id: 'wall-crack-reading',
    title: 'Retak dinding atau struktur',
    categories: ['Tukang Bangunan', 'Struktur'],
    triggers: ['retak', 'dinding', 'tembok', 'struktur', 'kolom', 'balok', 'miring', 'ambruk'],
    insight:
      'Arah dan perubahan retak lebih penting daripada lebarnya saja; retak diagonal yang bertambah cepat lebih mencurigakan dibanding rambut retak yang stabil.',
    safeChecks: [
      'Tanya bentuk retaknya: rambut, vertikal, horizontal, atau diagonal.',
      'Tanya apakah retak melebar cepat, pintu jadi seret, atau ada bunyi/penurunan.',
      'Minta pengguna menjauh jika ada bagian melendut atau terasa bergerak.',
    ],
    handoffSignal:
      'Sarankan teknisi bangunan jika retak diagonal melebar, struktur turun, plafon melendut, atau pintu/jendela mendadak seret.',
    avoid: 'Jangan memastikan aman hanya dari deskripsi chat.',
  },
  {
    id: 'paint-damp-root-cause',
    title: 'Cat mengelupas atau dinding lembap',
    categories: ['Tukang Cat', 'Finishing'],
    triggers: ['cat', 'mengelupas', 'lembap', 'jamur', 'dinding basah', 'rembes', 'noda'],
    insight:
      'Cat mengelupas sering bukan masalah catnya; kalau sumber lembap belum selesai, cat baru hanya menunda masalah yang sama muncul lagi.',
    safeChecks: [
      'Tanya apakah lembap muncul setelah hujan atau dekat kamar mandi/pipa.',
      'Tanya apakah ada bau apek, jamur, atau noda yang melebar.',
      'Sarankan bersihkan jamur ringan dengan ventilasi baik, tanpa mencampur cairan kimia.',
    ],
    handoffSignal:
      'Sarankan tukang jika lembap terus balik, ada rembes dari luar, atau perlu bongkar/plester ulang.',
    avoid: 'Jangan menyarankan langsung cat ulang sebagai solusi utama sebelum sumber air jelas.',
  },
] as const;

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function scoreSnippet(snippet: AssistantKnowledgeSnippet, queryTokens: Set<string>, category: string | null): number {
  let score = 0;
  const categories = snippet.categories.map((c) => c.toLowerCase());
  if (category && categories.includes(category.toLowerCase())) score += 6;

  for (const trigger of snippet.triggers) {
    const triggerTokens = tokenize(trigger);
    if (triggerTokens.every((token) => queryTokens.has(token))) {
      score += triggerTokens.length > 1 ? 3 : 2;
    }
  }

  return score;
}

export function retrieveAssistantKnowledge(
  query: string,
  category: string | null,
  limit = 3
): AssistantKnowledgeSnippet[] {
  const queryTokens = new Set(tokenize(query));
  return ASSISTANT_KNOWLEDGE.map((snippet) => ({
    snippet,
    score: scoreSnippet(snippet, queryTokens, category),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.snippet.id.localeCompare(b.snippet.id))
    .slice(0, limit)
    .map((item) => item.snippet);
}

export function formatKnowledgeForPrompt(snippets: readonly AssistantKnowledgeSnippet[]): string {
  if (snippets.length === 0) {
    return 'KONTEKS RAG DIAGNOSA:\n(tidak ada snippet diagnosa yang cocok; gunakan pertanyaan klarifikasi singkat dan jangan mengarang)';
  }

  return [
    'KONTEKS RAG DIAGNOSA:',
    ...snippets.map(
      (snippet, index) =>
        `[Snippet ${index + 1}: ${snippet.title}]\n` +
        `Insight: ${snippet.insight}\n` +
        `Cek aman: ${snippet.safeChecks.join(' | ')}\n` +
        `Sinyal perlu teknisi: ${snippet.handoffSignal}\n` +
        `Hindari: ${snippet.avoid}`
    ),
  ].join('\n\n');
}
