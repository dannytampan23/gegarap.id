import { z } from 'zod';
// Import the phone helpers from whatsapp.ts (their actual home), which is a pure
// transport/helper module with no Prisma/pg imports — safe for the client bundle
// (this module is imported by client forms).
import { normalizePhone, isValidIndonesianPhone } from '../whatsapp';

/**
 * Single source of truth for phone validation. Always normalises to the
 * canonical `628xxxxxxxxxx` form used everywhere else (User.phone, WA
 * notifications), so the old `^0[0-9]...` regex that never matched stored data
 * is gone for good.
 */
export const phoneSchema = z
  .string()
  .min(9, 'Nomor terlalu pendek')
  .transform(normalizePhone)
  .refine(isValidIndonesianPhone, 'Format nomor WA tidak valid');

export const PROVIDER_CATEGORIES = [
  'Tukang Ledeng',
  'Tukang Listrik',
  'Pembersih Rumah',
  'Tukang Kebun',
  'Tukang Bangunan',
] as const;

/** Operational areas (kecamatan) across Daerah Istimewa Yogyakarta. */
export const DISTRICTS = [
  'Depok',
  'Mlati',
  'Ngaglik',
  'Gamping',
  'Kalasan',
  'Gondokusuman',
  'Umbulharjo',
  'Mergangsan',
  'Jetis',
  'Kasihan',
  'Sewon',
  'Banguntapan',
] as const;

export const TIME_SLOTS = ['pagi', 'siang', 'sore'] as const;

export const MINIMUM_DP = 20_000;

/**
 * Booking input. Customer identity (name/WhatsApp) is NOT here — it comes from
 * the authenticated session on the server, never from the request body.
 */
export const bookingSchema = z.object({
  providerProfileId: z.string().min(1, 'Provider tidak valid'),
  description: z.string().trim().min(5, 'Jelaskan pekerjaan (min. 5 karakter)').max(500),
  customerAddress: z.string().trim().min(10, 'Alamat terlalu pendek (min. 10 karakter)').max(300),
  district: z.string().trim().min(1, 'Pilih kecamatan'),
  scheduledDate: z
    .string()
    .min(1, 'Pilih tanggal')
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Tanggal tidak valid'),
  timeSlot: z.enum(TIME_SLOTS, { message: 'Pilih waktu pengerjaan' }),
  estimatedDays: z.coerce.number().int().min(1, 'Minimal 1 hari').max(30, 'Maksimal 30 hari'),
  dpAmount: z.coerce.number().int().min(MINIMUM_DP, `DP minimal Rp ${MINIMUM_DP.toLocaleString('id-ID')}`).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export type BookingInput = z.infer<typeof bookingSchema>;

/**
 * Provider onboarding input. The provider is an authenticated User, so name
 * updates `User.name` and the phone comes from the session — neither is trusted
 * from the body except the display name.
 */
export const onboardingSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80),
  category: z.enum(PROVIDER_CATEGORIES, { message: 'Pilih kategori keahlian' }),
  districts: z
    .array(z.string().trim().min(1))
    .min(1, 'Pilih minimal 1 kecamatan')
    .max(5, 'Maksimal 5 kecamatan'),
  dailyRate: z.coerce
    .number()
    .min(50_000, 'Tarif minimal Rp 50.000')
    .max(5_000_000, 'Tarif maksimal Rp 5.000.000'),
  goPayNumber: phoneSchema,
  bio: z.string().trim().max(500).optional().or(z.literal('')),
  // Private-storage object PATH returned by /api/upload/ktp (no longer a public
  // URL). Resolved to a signed URL only for admin KYC review.
  ktpImageUrl: z.string().trim().min(1).max(300).optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/**
 * Full provider KYC onboarding (the 5-step wizard). Superset of the simple
 * onboarding above. `nik` and the document paths are sensitive PII — they are
 * stored server-side only and never appear in PROVIDER_PUBLIC_SELECT.
 *
 * Note: `dailyRate` is not one of the spec's listed step fields, but the schema
 * requires a rate for a provider to be bookable, so it is collected in step 2.
 */
export const kycOnboardingSchema = z.object({
  // Step 1 — Data Diri
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80),
  nik: z.string().trim().regex(/^\d{16}$/, 'NIK harus tepat 16 digit angka'),
  ktpImageUrl: z.string().trim().min(1, 'Upload foto KTP terlebih dahulu').max(300),
  // Step 2 — Keahlian
  categories: z
    .array(z.enum(PROVIDER_CATEGORIES))
    .min(1, 'Pilih minimal 1 keahlian')
    .max(5, 'Maksimal 5 keahlian'),
  experienceYears: z.coerce
    .number()
    .int('Masukkan angka bulat')
    .min(0, 'Tidak boleh negatif')
    .max(60, 'Maksimal 60 tahun'),
  dailyRate: z.coerce
    .number()
    .min(50_000, 'Tarif minimal Rp 50.000')
    .max(5_000_000, 'Tarif maksimal Rp 5.000.000'),
  // Step 3 — Lokasi
  districts: z
    .array(z.string().trim().min(1))
    .min(1, 'Pilih minimal 1 kecamatan')
    .max(5, 'Maksimal 5 kecamatan'),
  serviceRadiusKm: z.coerce
    .number()
    .int('Masukkan angka bulat')
    .min(1, 'Minimal 1 km')
    .max(50, 'Maksimal 50 km'),
  // Step 4 — Dokumen
  faceImageUrl: z.string().trim().min(1, 'Upload foto wajah terlebih dahulu').max(300),
  certificateUrl: z.string().trim().min(1).max(300).optional(),
});

export type KycOnboardingInput = z.infer<typeof kycOnboardingSchema>;

/**
 * Per-step validators, indexed by zero-based step. Step 5 (Review) has no fields
 * of its own — it only gates on the consent checkbox, handled in the form. The
 * wizard runs the matching schema before allowing "Lanjut".
 */
export const kycStepSchemas = [
  kycOnboardingSchema.pick({ name: true, nik: true, ktpImageUrl: true }),
  kycOnboardingSchema.pick({ categories: true, experienceYears: true, dailyRate: true }),
  kycOnboardingSchema.pick({ districts: true, serviceRadiusKm: true }),
  kycOnboardingSchema.pick({ faceImageUrl: true, certificateUrl: true }),
] as const;

export const KYC_STEP_COUNT = 5;

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80),
  phone: phoneSchema,
  message: z.string().trim().min(10, 'Pesan terlalu pendek (min. 10 karakter)').max(1000),
});

export type ContactInput = z.infer<typeof contactSchema>;

/** Flattens a ZodError into a `{ field: message }` map for the UI. */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
