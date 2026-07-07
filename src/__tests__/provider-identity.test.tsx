import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mockPrisma } from './mocks/prisma';
import { buildVerificationBadges, maskNik } from '@/lib/provider-verification';
import { kycOnboardingSchema, nikSchema, onboardingSchema } from '@/lib/validations';
import StepForm from '@/components/onboarding/StepForm';
import { ToastProvider } from '@/components/ui/Toast';

const getSession = vi.hoisted(() => vi.fn());
const adminSet = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/firebase/session', () => ({
  getSession,
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ set: adminSet }),
    }),
  },
}));

import { POST as onboardingPost } from '@/app/api/onboarding/route';

const validPayload = {
  name: 'Budi Santoso',
  nik: '3404000000001234',
  categories: ['Tukang Listrik'],
  experienceYears: 5,
  dailyRate: 200_000,
  districts: ['Depok'],
  serviceRadiusKm: 10,
};

describe('provider identity verification', () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    adminSet.mockResolvedValue(undefined);
  });

  it('validates NIK as exactly 16 numeric digits', () => {
    expect(nikSchema.safeParse('3404000000001234').success).toBe(true);
    expect(nikSchema.safeParse('3404 0000 0000 1234').success).toBe(false);
    expect(nikSchema.safeParse('340400000000123').success).toBe(false);
    expect(nikSchema.safeParse('34040000000012345').success).toBe(false);
    expect(nikSchema.safeParse('340400000000abcd').success).toBe(false);
  });

  it('onboarding schemas no longer require or accept ktpImageUrl', () => {
    expect(kycOnboardingSchema.safeParse(validPayload).success).toBe(true);
    expect(onboardingSchema.safeParse({
      name: 'Budi Santoso',
      nik: '3404000000001234',
      category: 'Tukang Listrik',
      districts: ['Depok'],
      dailyRate: 200_000,
      goPayNumber: '081234567890',
      bio: '',
    }).success).toBe(true);

    const withKtp = kycOnboardingSchema.safeParse({
      ...validPayload,
      ktpImageUrl: 'private/ktp.jpg',
    });
    expect(withKtp.success).toBe(true);
    if (withKtp.success) {
      expect(withKtp.data).not.toHaveProperty('ktpImageUrl');
    }
  });

  it('renders NIK-only onboarding copy without KTP upload input', () => {
    render(
      <ToastProvider>
        <StepForm />
      </ToastProvider>
    );

    expect(screen.getByText(/tidak menyimpan foto KTP/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/NIK/i)).toBeInTheDocument();
    expect(screen.queryByText('Foto KTP')).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('rejects invalid NIK in onboarding API before DB writes', async () => {
    const req = new Request('https://gegarap.id/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({ ...validPayload, nik: '1234' }),
    });

    const res = await onboardingPost(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.errors.nik).toBe('NIK harus terdiri dari 16 digit angka.');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('masks NIK and derives public trust badges without exposing identifiers', () => {
    expect(maskNik('3404000000001234')).toBe('************1234');
    expect(maskNik('1234')).toBe('************1234');
    expect(buildVerificationBadges({ identityStatus: 'MANUALLY_VERIFIED' })).toEqual([
      { code: 'GEGARAP_VERIFIED', label: 'Terverifikasi Gegarap' },
    ]);
  });
});
