import { describe, it, expect } from 'vitest';
import {
  PROVIDER_PUBLIC_SELECT,
  PROVIDER_MAP_SELECT,
  toPublicProvider,
  toMapProvider,
  fuzzCoordinate,
} from '@/lib/providers';

const FORBIDDEN_PUBLIC_DTO_KEYS = [
  'payoutDetails',
  'payoutMethod',
  'goPayNumber',
  'ktpImageUrl',
  'nik',
  'nikHash',
  'nikLast4',
  'identityStatus',
  'phoneVerifiedAt',
  'payoutStatus',
  'latitude',
  'longitude',
  'userId',
  'kycStatus',
  'kycReason',
];

const FORBIDDEN_SELECT_KEYS = [
  'payoutDetails',
  'payoutMethod',
  'goPayNumber',
  'ktpImageUrl',
  'nik',
  'nikHash',
  'nikLast4',
  'latitude',
  'longitude',
  'userId',
  'kycStatus',
  'kycReason',
];

const ALLOWED_PUBLIC_KEYS = [
  'id',
  'category',
  'districts',
  'dailyRate',
  'bio',
  'avatarUrl',
  'rating',
  'ratingCount',
  'completedJobs',
  'available',
  'verificationBadges',
  'user',
];

const ALLOWED_MAP_KEYS = ['id', 'category', 'dailyRate', 'latitude', 'longitude', 'user'];

describe('Provider public projection', () => {
  it('PROVIDER_PUBLIC_SELECT tidak mengambil PII atau field finansial', () => {
    for (const k of FORBIDDEN_SELECT_KEYS) {
      expect(PROVIDER_PUBLIC_SELECT).not.toHaveProperty(k);
    }
  });

  it('PROVIDER_MAP_SELECT tidak membocorkan payout/KTP/NIK', () => {
    for (const k of ['payoutDetails', 'payoutMethod', 'goPayNumber', 'ktpImageUrl', 'nik', 'nikHash', 'userId']) {
      expect(PROVIDER_MAP_SELECT).not.toHaveProperty(k);
    }
  });

  it('toPublicProvider whitelist ketat dan hanya mengirim verificationBadges', () => {
    const leaky = {
      id: 'p1',
      category: 'Tukang',
      districts: ['A'],
      dailyRate: 150_000,
      bio: null,
      avatarUrl: null,
      rating: 4.8,
      ratingCount: 12,
      completedJobs: 12,
      available: true,
      user: { name: 'Joko' },
      identityStatus: 'MANUALLY_VERIFIED',
      phoneVerifiedAt: null,
      payoutStatus: 'UNVERIFIED',
      ktpImageUrl: 'private/ktp.jpg',
      nik: '3404000000001234',
      nikHash: 'hash',
      nikLast4: '1234',
      payoutDetails: { accountNumber: '123' },
      latitude: -6.2000001,
      longitude: 106.8000001,
      userId: 'u1',
    };

    const dto = toPublicProvider(leaky);
    const keys = Object.keys(dto).sort();
    expect(keys).toEqual([...ALLOWED_PUBLIC_KEYS].sort());
    for (const k of FORBIDDEN_PUBLIC_DTO_KEYS) expect(dto).not.toHaveProperty(k);
    expect(dto.verificationBadges).toEqual([
      { code: 'GEGARAP_VERIFIED', label: 'Terverifikasi Gegarap' },
    ]);
    expect(Object.keys(dto.user)).toEqual(['name']);
  });

  it('toMapProvider whitelist + koordinat difuzz, tanpa field sensitif', () => {
    const raw = {
      id: 'p1',
      category: 'Tukang',
      dailyRate: 150_000,
      latitude: -6.2000001,
      longitude: 106.8000001,
      user: { name: 'Joko' },
      ktpImageUrl: 'private/ktp.jpg',
      payoutDetails: { accountNumber: '123' },
    } as never;

    const dto = toMapProvider(raw);
    expect(Object.keys(dto).sort()).toEqual([...ALLOWED_MAP_KEYS].sort());
    expect(dto.latitude).not.toBe(-6.2000001);
    expect(dto.latitude).toBe(-6.2);
    expect(dto.longitude).toBe(106.8);
  });
});

describe('Coordinate fuzzing determinism', () => {
  it('input sama menghasilkan output identik', () => {
    const lat = -6.214612345;
    const first = fuzzCoordinate(lat);
    for (let i = 0; i < 50; i++) {
      expect(fuzzCoordinate(lat)).toBe(first);
    }
  });

  it('null menjadi null', () => {
    expect(fuzzCoordinate(null)).toBeNull();
  });

  it('membulatkan ke grid kasar, bukan jitter acak', () => {
    expect(fuzzCoordinate(-6.2049)).toBe(-6.2);
    expect(fuzzCoordinate(-6.2051)).toBe(-6.21);
  });
});
