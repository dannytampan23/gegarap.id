import { z } from 'zod';

export const assistantResponseSchema = z.object({
  message: z.string().trim().min(1),
  category: z.string().trim().min(1),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  confidenceLevel: z.enum(['low', 'medium', 'high']).default('low'),
  bookingEligible: z.boolean().default(false),
  suggestedNextAction: z.string().trim().default(''),
  quickReplies: z.array(z.string().trim().min(1)).max(3).default([]),
  rekomendasi: z.array(
    z.object({
      id: z.string().trim().min(1),
      nama: z.string().trim().min(1),
      layanan: z.string().trim().min(1),
      estimasi_harga: z.string().trim().min(1),
      rating: z.string().trim().min(1),
      alasan: z.string().trim().min(1),
      highlight: z.string().trim().min(1)
    })
  ).default([]),
  catatan: z.string().default(''),
  cta: z.string().default(''),
  pesan: z.string().trim().min(1).optional()
}).transform((value) => ({
  ...value,
  pesan: value.pesan || value.message
}));
