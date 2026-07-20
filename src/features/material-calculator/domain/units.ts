/**
 * Unit normalisation and numeric helpers.
 *
 * Users think in metres, centimetres, or millimetres; the engine only ever
 * reasons in metres. Every length crosses this boundary exactly once, here, so
 * no formula ever has to worry about units.
 */
import type { LengthUnit, Rounding } from './types';

const TO_METRES: Record<LengthUnit, number> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
};

export const LENGTH_UNITS: LengthUnit[] = ['m', 'cm', 'mm'];

export function isLengthUnit(value: unknown): value is LengthUnit {
  return value === 'm' || value === 'cm' || value === 'mm';
}

/** Convert a length in the given unit to metres. Non-finite input → 0. */
export function toMetres(value: number, unit: LengthUnit): number {
  if (!Number.isFinite(value)) return 0;
  return value * TO_METRES[unit];
}

/** Convert a metre-normalised length back to the requested display unit. */
export function fromMetres(value: number, unit: LengthUnit): number {
  if (!Number.isFinite(value)) return 0;
  return value / TO_METRES[unit];
}

/** Round a value according to a Rounding strategy. */
export function applyRounding(value: number, mode: Rounding = 'ceil'): number {
  if (!Number.isFinite(value)) return 0;
  switch (mode) {
    case 'ceil':
      return Math.ceil(value);
    case 'round':
      return Math.round(value);
    case 'round1':
      return Math.round(value * 10) / 10;
    case 'round2':
      return Math.round(value * 100) / 100;
  }
}

/** Integer Rupiah rounding for money — never emit fractional cents of Rupiah. */
export function toRupiah(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}
