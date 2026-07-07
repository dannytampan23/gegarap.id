import { describe, expect, it } from 'vitest';
import { runSafetyClassifier } from '@/ai/gegarap-assistant/safety-classifier';
import { detectCategory } from '@/ai/gegarap-assistant/diagnosis-classifier';
import { evaluateBookingEligibility } from '@/ai/gegarap-assistant/booking-handoff';
import { runQualityGuard } from '@/ai/gegarap-assistant/quality-guard';
import { processChat } from '@/ai/gegarap-assistant/engine';
import { assistantResponseSchema } from '@/ai/gegarap-assistant/validators';
import { AssistantResponse } from '@/ai/gegarap-assistant/types';

describe('Gegarap Assistant Engine', () => {
  describe('Safety Classifier', () => {
    it('detects electrical burning smell and triggers critical risk', () => {
      const result = runSafetyClassifier('Ada bau gosong dari stop kontak dan panas banget');
      expect(result.isSafety).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.alerts[0].type).toBe('electrical_fire');
    });

    it('detects leaking faucet as safe (low risk)', () => {
      const result = runSafetyClassifier('Keran di kamar mandi bocor terus netes');
      expect(result.isSafety).toBe(false);
      expect(result.riskLevel).toBe('low');
    });

    it('detects exposed wire', () => {
      const result = runSafetyClassifier('Ada kabel telanjang dekat stop kontak');
      expect(result.isSafety).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.alerts[0].type).toBe('electrical_fire');
    });

    it('detects water near electricity', () => {
      const result = runSafetyClassifier('Air dekat stop kontak karena banjir kecil');
      expect(result.isSafety).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.alerts[0].type).toBe('water_electricity');
    });

    it('detects gas leak', () => {
      const result = runSafetyClassifier('Dapur bau gas dan ada desisan gas');
      expect(result.isSafety).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.alerts[0].type).toBe('gas_leak');
    });

    it('detects structural danger', () => {
      const result = runSafetyClassifier('Plafonnya melengkung turun kayak mau ambruk');
      expect(result.isSafety).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.alerts[0].type).toBe('structural_collapse');
    });
  });

  describe('Diagnosis Classifier', () => {
    it('detects AC category', () => {
      const category = detectCategory('AC saya gak dingin walau udah diset 16 derajat', []);
      expect(category).toBe('AC');
    });

    it('detects roof leak category', () => {
      const category = detectCategory('Atap bocor kalau hujan deras', []);
      expect(category).toBe('Tukang Atap');
    });

    it('detects CCTV category', () => {
      const category = detectCategory('Kamera pengintai di depan rumah offline', []);
      expect(category).toBe('CCTV');
    });

    it('detects Plumbing category with history fallback', () => {
      const history = [{ role: 'user', content: 'Di kamar mandi' }];
      const category = detectCategory('Ada pipa yang pecah', history);
      expect(category).toBe('Tukang Ledeng');
    });
  });

  describe('Booking Handoff', () => {
    const defaultHistory = [{ role: 'user', content: 'AC mati' }];

    it('returns eligible if user explicitly asks for technician', () => {
      const result = evaluateBookingEligibility('low', 'low', 'tolong carikan teknisi dong', defaultHistory, true);
      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('explicitly requested');
    });

    it('returns eligible if confidence is medium and risk is medium', () => {
      const result = evaluateBookingEligibility('medium', 'medium', 'listrik jeglek kalau nyalain pompa', defaultHistory, true);
      expect(result.eligible).toBe(true);
    });

    it('returns ineligible if still diagnosing (low confidence, low risk)', () => {
      const result = evaluateBookingEligibility('low', 'low', 'ac kurang dingin', defaultHistory, true);
      expect(result.eligible).toBe(false);
    });

    it('does not push booking for a price-only diagnosis question', () => {
      const result = evaluateBookingEligibility('low', 'low', 'berapa harga servis AC?', [], true);
      expect(result.eligible).toBe(false);
    });

    it('returns ineligible if no providers are available', () => {
      const result = evaluateBookingEligibility('high', 'high', 'tolong carikan teknisi dong', defaultHistory, false);
      expect(result.eligible).toBe(false);
    });
  });

  describe('Quality Guard', () => {
    const validResponse: AssistantResponse = {
      message: 'Oke, kita cek pelan-pelan ya. Angin AC-nya masih keluar kencang atau kecil?',
      category: 'AC',
      riskLevel: 'low',
      confidenceLevel: 'low',
      bookingEligible: false,
      suggestedNextAction: 'Tanya airflow',
      pesan: 'Oke, kita cek pelan-pelan ya. Angin AC-nya masih keluar kencang atau kecil?',
      rekomendasi: [],
      catatan: '',
      cta: ''
    };

    it('passes valid human-like response', () => {
      const guard = runQualityGuard(validResponse, []);
      expect(guard.valid).toBe(true);
    });

    it('rejects robotic patterns', () => {
      const roboticResponse = { ...validResponse, message: 'Sebagai AI, berikut beberapa penyebab AC tidak dingin.' };
      const guard = runQualityGuard(roboticResponse, []);
      expect(guard.valid).toBe(false);
      expect(guard.reasons[0]).toContain('robotic pattern');
    });

    it('rejects repeated questions', () => {
      const history = [{ role: 'assistant', content: 'Anginnya kencang atau kecil?' }];
      const repeatedResponse = { ...validResponse, message: 'Anginnya kencang atau kecil?' };
      const guard = runQualityGuard(repeatedResponse, history);
      expect(guard.valid).toBe(false);
      expect(guard.reasons[0]).toContain('Repeated a question');
    });
  });

  describe('Response Contract', () => {
    it('accepts the required assistant API shape', () => {
      const parsed = assistantResponseSchema.parse({
        message: 'Oke, saya cek dulu dari gejalanya ya.',
        category: 'AC',
        riskLevel: 'low',
        confidenceLevel: 'low',
        bookingEligible: false,
        suggestedNextAction: 'Tanya gejala utama',
        rekomendasi: [],
        catatan: '',
        cta: ''
      });

      expect(parsed).toMatchObject({
        message: expect.any(String),
        category: 'AC',
        riskLevel: 'low',
        confidenceLevel: 'low',
        bookingEligible: false,
        suggestedNextAction: expect.any(String),
        pesan: 'Oke, saya cek dulu dari gejalanya ya.'
      });
    });

    it('rejects broken assistant API shape', () => {
      const parsed = assistantResponseSchema.safeParse({
        message: '',
        category: 'AC',
        riskLevel: 'urgent',
        confidenceLevel: 'low',
        bookingEligible: false,
        suggestedNextAction: '',
        rekomendasi: [],
        catatan: '',
        cta: ''
      });

      expect(parsed.success).toBe(false);
    });
  });

  describe('Critical safety response', () => {
    it('stops normal troubleshooting and prevents unsafe DIY', async () => {
      const response = await processChat({
        query: 'Stop kontak bau gosong, cara bongkar sendiri gimana?',
        history: [],
        providers: [
          {
            id: 'provider-1',
            name: 'Teknisi Listrik',
            category: 'Tukang Listrik',
            categories: [],
            districts: ['Cilandak'],
            rating: 4.8,
            ratingCount: 12,
            dailyRate: 300000,
            completedJobs: 20,
            fraudBadge: null,
            bio: ''
          }
        ]
      });

      expect(response.riskLevel).toBe('critical');
      expect(response.bookingEligible).toBe(false);
      expect(response.rekomendasi).toHaveLength(0);
      expect(response.message.toLowerCase()).toContain('jangan');
      expect(response.message.toLowerCase()).not.toContain('bongkar');
    });
  });
});
