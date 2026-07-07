import { createHash, createHmac } from 'node:crypto';

export const IDENTITY_STATUSES = [
  'UNVERIFIED',
  'PHONE_VERIFIED',
  'IDENTITY_SUBMITTED',
  'MANUALLY_VERIFIED',
  'REJECTED',
  'SUSPENDED',
] as const;

export type IdentityStatus = (typeof IDENTITY_STATUSES)[number];

export const PAYOUT_STATUSES = ['UNVERIFIED', 'SUBMITTED', 'VERIFIED', 'REJECTED'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export interface VerificationBadge {
  code: 'IDENTITY_SUBMITTED' | 'PHONE_VERIFIED' | 'GEGARAP_VERIFIED' | 'PAYOUT_VERIFIED';
  label: string;
}

const NIK_DIGITS = /^\d{16}$/;

export function isValidNik(nik: string): boolean {
  return NIK_DIGITS.test(nik);
}

export function maskNik(nikOrLast4: string | null | undefined): string {
  if (!nikOrLast4) return '-';
  const digits = nikOrLast4.replace(/\D/g, '');
  const last4 = digits.length >= 4 ? digits.slice(-4) : digits;
  return last4 ? `************${last4}` : '-';
}

export function nikLast4(nik: string): string {
  return nik.slice(-4);
}

export function hashNik(nik: string): string {
  const secret = process.env.NIK_HASH_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (secret) {
    return createHmac('sha256', secret).update(nik).digest('hex');
  }
  return createHash('sha256').update(`gegarap-id:${nik}`).digest('hex');
}

export function normalizeIdentityStatus(value: string | null | undefined): IdentityStatus {
  return IDENTITY_STATUSES.includes(value as IdentityStatus) ? (value as IdentityStatus) : 'UNVERIFIED';
}

export function normalizePayoutStatus(value: string | null | undefined): PayoutStatus {
  return PAYOUT_STATUSES.includes(value as PayoutStatus) ? (value as PayoutStatus) : 'UNVERIFIED';
}

export function buildVerificationBadges(input: {
  identityStatus?: string | null;
  phoneVerifiedAt?: Date | string | null;
  payoutStatus?: string | null;
}): VerificationBadge[] {
  const identityStatus = normalizeIdentityStatus(input.identityStatus);
  const payoutStatus = normalizePayoutStatus(input.payoutStatus);
  const badges: VerificationBadge[] = [];

  if (identityStatus === 'MANUALLY_VERIFIED') {
    badges.push({ code: 'GEGARAP_VERIFIED', label: 'Terverifikasi Gegarap' });
  } else if (identityStatus === 'IDENTITY_SUBMITTED' || identityStatus === 'PHONE_VERIFIED') {
    badges.push({ code: 'IDENTITY_SUBMITTED', label: 'Identitas diajukan' });
  }

  if (input.phoneVerifiedAt) {
    badges.push({ code: 'PHONE_VERIFIED', label: 'Nomor HP terverifikasi' });
  }

  if (payoutStatus === 'VERIFIED') {
    badges.push({ code: 'PAYOUT_VERIFIED', label: 'Rekening terverifikasi' });
  }

  return badges;
}
