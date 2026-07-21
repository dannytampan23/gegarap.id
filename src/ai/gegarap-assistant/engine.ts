import { logEvent } from '@/lib/logger';
import { createStructuredResponse, DEFAULT_OPENAI_MODEL, isOpenAIConfigured } from '@/lib/ai/openai';
import { fallbackRecommendation } from '@/lib/ai/prompt';
import type { SearchedProvider } from '@/lib/ai/search';
import { AssistantRequest, AssistantResponse } from './types';
import { runSafetyClassifier } from './safety-classifier';
import { detectCategory } from './diagnosis-classifier';
import { buildConversationMemory, formatMemoryForPrompt } from './memory';
import { evaluateBookingEligibility } from './booking-handoff';
import { runQualityGuard } from './quality-guard';
import { assistantResponseSchema } from './validators';
import { retrieveAssistantKnowledge, formatKnowledgeForPrompt } from './rag';

import { SYSTEM_PROMPT } from './prompts/system';
import { SAFETY_PROMPT } from './prompts/safety';
import { DIAGNOSIS_PROMPT } from './prompts/diagnosis';
import { BOOKING_PROMPT } from './prompts/booking';
import { CATEGORIES_PROMPT } from './prompts/categories';
import { TONE_PROMPT } from './prompts/tone';
import { INSIGHT_PROMPT } from './prompts/insight';

const MAX_OUTPUT_TOKENS = 1024;

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

function buildDiagnosisFallback(query: string, category: string | null): AssistantResponse {
  const detectedCategory = category || 'Lainnya';
  const shortQuery = query.length > 80 ? `${query.slice(0, 77)}...` : query;
  const message =
    detectedCategory === 'Lainnya'
      ? `Saya tangkap masalahnya: ${shortQuery}.\n\nBiar saya arahkan dengan tepat, ini terjadi di bagian rumah yang mana?`
      : `Oke, saya catat ini terkait ${detectedCategory}.\n\nBiar tidak menebak terlalu cepat, gejala yang paling terasa sekarang apa?`;

  return {
    message,
    category: detectedCategory,
    riskLevel: 'low',
    confidenceLevel: 'low',
    bookingEligible: false,
    suggestedNextAction: 'Lanjutkan diagnosa dengan satu pertanyaan klarifikasi.',
    quickReplies: ['Gejalanya makin parah', 'Terjadi sejak hari ini', 'Saya butuh teknisi'],
    pesan: message,
    rekomendasi: [],
    catatan: '',
    cta: ''
  };
}

function buildProviderContext(providers: AssistantRequest['providers']): string {
  if (!providers || providers.length === 0) {
    return '(tidak ada tukang yang cocok dengan kriteria)';
  }
  return providers
    .map(
      (p, i) =>
        `[Tukang ${i + 1}]\n` +
        `id: ${p.id}\n` +
        `Nama: ${p.name}\n` +
        `Layanan: ${[p.category, ...(p.categories || []).filter((c) => c !== p.category)].join(', ')}\n` +
        `Area: ${(p.districts || []).join(', ') || '-'}\n` +
        `Rating: ${p.rating.toFixed(1)}/5 (${p.ratingCount} ulasan)\n` +
        `Tarif harian: ${rp(p.dailyRate)}\n` +
        `Pekerjaan selesai: ${p.completedJobs}\n` +
        (p.fraudBadge === 'baru' ? `Catatan: tukang baru bergabung\n` : '') +
        (p.bio ? `Bio: ${p.bio}\n` : '')
    )
    .join('\n');
}

function buildDeterministicFallbackResponse(
  query: string,
  category: string | null,
  providers: AssistantRequest['providers']
): AssistantResponse {
  const fallbackProviders: SearchedProvider[] = providers.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    categories: p.categories ?? [],
    districts: p.districts ?? [],
    dailyRate: p.dailyRate,
    rating: p.rating,
    ratingCount: p.ratingCount,
    completedJobs: p.completedJobs,
    bio: p.bio ?? null,
    avatarUrl: null,
    fraudBadge: p.fraudBadge ?? null,
  }));
  const legacy = fallbackRecommendation(query, fallbackProviders);
  const message = legacy.pesan;
  return {
    message,
    category: category || 'Lainnya',
    riskLevel: 'low',
    confidenceLevel: legacy.rekomendasi.length > 0 ? 'medium' : 'low',
    bookingEligible: legacy.rekomendasi.length > 0,
    suggestedNextAction:
      legacy.rekomendasi.length > 0
        ? 'Pilih salah satu tukang yang direkomendasikan.'
        : 'Lanjutkan diagnosa dengan satu pertanyaan klarifikasi.',
    quickReplies:
      legacy.rekomendasi.length > 0
        ? ['Bandingkan pilihan', 'Cari area lain', 'Saya mau booking']
        : ['Gejalanya makin parah', 'Terjadi sejak hari ini', 'Saya butuh teknisi'],
    pesan: message,
    rekomendasi: legacy.rekomendasi,
    catatan: legacy.catatan,
    cta: legacy.cta,
  };
}

function buildCriticalSafetyResponse(query: string, category: string | null): AssistantResponse {
  const safety = runSafetyClassifier(query);
  const issue = safety.alerts[0]?.type;
  const gas = issue === 'gas_leak';
  const structure = issue === 'structural_collapse';
  const waterElectric = issue === 'water_electricity';

  const message = gas
    ? 'Ini jangan dicek sendiri dulu ya. Jauhi area yang bau gas, jangan nyalakan atau matikan saklar listrik, buka ventilasi kalau aman, lalu tutup katup gas dari posisi yang aman.\n\nSetelah itu panggil bantuan profesional. Jangan coba cari sumber bocornya pakai api atau bongkar regulator sendiri.'
    : structure
      ? 'Ini masuk risiko serius. Tolong jauhi area yang retak, melengkung, atau terlihat mau turun dulu.\n\nJangan berdiri di bawah plafon/atap itu dan jangan coba ditopang sendiri. Lebih aman minta teknisi bangunan mengecek langsung.'
      : waterElectric
        ? 'Ini berbahaya, jangan sentuh perangkat atau stop kontak yang terkena air. Menjauh dulu dari area basah.\n\nKalau MCB utama aman dijangkau dari tempat kering, matikan listrik utama. Setelah itu minta teknisi listrik menangani pengecekan.'
        : 'Ini jangan dicek sendiri dulu ya. Kalau ada bau gosong, asap, kabel terbuka, atau bagian listrik panas, menjauh dari area itu.\n\nMatikan MCB utama hanya kalau posisinya aman dijangkau, lalu minta teknisi listrik mengecek langsung. Jangan sentuh kabel, stop kontak, atau perangkat yang panas/basah.';

  return {
    message,
    category: category || 'Keselamatan',
    riskLevel: 'critical',
    confidenceLevel: 'high',
    bookingEligible: false,
    suggestedNextAction: 'Jauhi area berbahaya dan panggil bantuan profesional.',
    quickReplies: ['Saya sudah menjauh', 'MCB aman dijangkau?', 'Butuh teknisi darurat'],
    pesan: message,
    rekomendasi: [],
    catatan: 'Keselamatan dulu. Jangan lakukan DIY pada kondisi ini.',
    cta: ''
  };
}

export async function processChat(req: AssistantRequest): Promise<AssistantResponse> {
  const { query, history, providers } = req;

  const safety = runSafetyClassifier(query);
  const category = detectCategory(query, history);

  if (safety.riskLevel === 'critical') {
    return buildCriticalSafetyResponse(query, category);
  }

  const memory = buildConversationMemory(history);
  memory.category = category;
  const knowledge = retrieveAssistantKnowledge(query, category);

  let extraPrompt = '';
  if (safety.isSafety) {
    extraPrompt = `\n\nPERINGATAN KESELAMATAN TERDETEKSI: Risiko ${safety.riskLevel.toUpperCase()}. Arahkan pengguna menjauh dari bahaya.`;
  }

  const fullSystemPrompt = [
    SYSTEM_PROMPT,
    SAFETY_PROMPT,
    DIAGNOSIS_PROMPT,
    BOOKING_PROMPT,
    CATEGORIES_PROMPT,
    TONE_PROMPT,
    INSIGHT_PROMPT,
    formatMemoryForPrompt(memory),
    formatKnowledgeForPrompt(knowledge),
    extraPrompt
  ].join('\n\n');

  const providerContext = buildProviderContext(providers);
  const userPrompt =
    `DATA TUKANG TERSEDIA:\n${providerContext}\n\n` +
    `PERMINTAAN PENGGUNA TERBARU:\n"${query}"\n\n` +
    'Gunakan konteks RAG diagnosa dan data tukang di system prompt. Jika keduanya tidak cukup, ajukan satu pertanyaan klarifikasi terbaik.';

  if (!isOpenAIConfigured()) {
    return buildDeterministicFallbackResponse(query, category, providers);
  }

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history.slice(-10).map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: userPrompt },
  ];

  const jsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      message: { type: 'string', description: 'Jawaban utama asisten. Maks 5 paragraf pendek.' },
      category: { type: 'string', description: 'Kategori masalah (misal: AC, Listrik, Plumbing)' },
      riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
      confidenceLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
      bookingEligible: { type: 'boolean', description: 'Apakah sudah layak menampilkan CTA booking' },
      suggestedNextAction: { type: 'string', description: 'Tindakan yang disarankan selanjutnya secara singkat' },
      quickReplies: { type: 'array', items: { type: 'string' }, description: 'Maks 3 opsi balasan cepat untuk pengguna' },
      pesan: { type: 'string', description: 'Sama dengan message' },
      rekomendasi: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            nama: { type: 'string' },
            layanan: { type: 'string' },
            estimasi_harga: { type: 'string' },
            rating: { type: 'string' },
            alasan: { type: 'string' },
            highlight: { type: 'string' }
          },
          additionalProperties: false,
          required: ['id', 'nama', 'layanan', 'estimasi_harga', 'rating', 'alasan', 'highlight']
        }
      },
      catatan: { type: 'string' },
      cta: { type: 'string' }
    },
    required: [
      'message',
      'category',
      'riskLevel',
      'confidenceLevel',
      'bookingEligible',
      'suggestedNextAction',
      'quickReplies',
      'pesan',
      'rekomendasi',
      'catatan',
      'cta'
    ]
  } satisfies Record<string, unknown>;

  const output = await createStructuredResponse<unknown>({
    model: process.env.GEGARAP_AI_MODEL || DEFAULT_OPENAI_MODEL,
    maxOutputTokens: Number(process.env.GEGARAP_AI_MAX_TOKENS) || MAX_OUTPUT_TOKENS,
    system: fullSystemPrompt,
    input: messages,
    schemaName: 'gegarap_assistant_response',
    schemaDescription: 'Structured response for the Gegarap home-services assistant',
    schema: jsonSchema,
  });

  const schemaResult = assistantResponseSchema.safeParse(output);
  if (!schemaResult.success) {
    logEvent('ai.chat.schema_invalid', { issues: schemaResult.error.issues.map((issue) => issue.path.join('.')) }, 'warn');
    return buildDiagnosisFallback(query, category);
  }

  let parsed: AssistantResponse = schemaResult.data;
  parsed.category = parsed.category || category || 'Lainnya';

  const guard = runQualityGuard(parsed, history);
  if (!guard.valid) {
    logEvent('ai.chat.quality_guard_failed', { reasons: guard.reasons }, 'warn');
    parsed = buildDiagnosisFallback(query, category);
  }

  const booking = evaluateBookingEligibility(
    parsed.confidenceLevel,
    parsed.riskLevel,
    query,
    history,
    providers.length > 0
  );

  parsed.bookingEligible = booking.eligible;
  parsed.pesan = parsed.pesan || parsed.message;
  parsed.quickReplies = (parsed.quickReplies ?? []).slice(0, 3);

  if (!booking.eligible) {
    parsed.rekomendasi = [];
    parsed.cta = '';
  }

  return parsed;
}
