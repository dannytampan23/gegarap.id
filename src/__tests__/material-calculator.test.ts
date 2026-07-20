import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { toMetres, fromMetres, applyRounding } from '@/features/material-calculator/domain/units';
import { getFormula, FORMULAS } from '@/features/material-calculator/configs/material-formulas';
import {
  runCalculation,
  buildPriceBook,
  calculateWithForm,
} from '@/features/material-calculator/application/service';
import { normalizeInputs } from '@/features/material-calculator/application/dto';
import { NotFoundError } from '@/lib/errors';

/** Convenience: read one material line from a result. */
function line(result: ReturnType<typeof runCalculation>, material: string) {
  const l = result.materials.find((m) => m.material === material);
  if (!l) throw new Error(`material ${material} not found`);
  return l;
}

describe('units', () => {
  it('normalises lengths to metres', () => {
    expect(toMetres(6, 'm')).toBe(6);
    expect(toMetres(600, 'cm')).toBeCloseTo(6);
    expect(toMetres(6000, 'mm')).toBeCloseTo(6);
    expect(toMetres(Number.NaN, 'm')).toBe(0);
  });

  it('converts metre-normalised lengths back to display units', () => {
    expect(fromMetres(6, 'm')).toBe(6);
    expect(fromMetres(6, 'cm')).toBe(600);
    expect(fromMetres(6, 'mm')).toBe(6000);
    expect(fromMetres(Number.NaN, 'm')).toBe(0);
  });

  it('rounds by strategy', () => {
    expect(applyRounding(4.14, 'ceil')).toBe(5);
    expect(applyRounding(0.774, 'round2')).toBe(0.77);
    expect(applyRounding(1.55, 'round1')).toBe(1.6);
    expect(applyRounding(1.4, 'round')).toBe(1);
  });

});

describe('config integrity', () => {
  it('every material line references a priced material', () => {
    const book = buildPriceBook();
    for (const f of FORMULAS) {
      for (const m of f.materials) {
        expect(book[m.material], `${f.id} → ${m.material}`).toBeDefined();
      }
    }
  });

  it('every length input has a metre-scaled default within bounds', () => {
    for (const f of FORMULAS) {
      for (const spec of f.inputs) {
        if (spec.kind === 'length' && spec.min !== undefined) {
          expect(Number(spec.default)).toBeGreaterThanOrEqual(spec.min);
        }
      }
    }
  });
});

describe('engine — dinding bata merah (6 × 3 m)', () => {
  const result = runCalculation({
    jobId: 'dinding-bata-merah',
    inputs: { panjang: 6, tinggi: 3, bukaan: 0 },
  });

  it('derives wall area', () => {
    expect(result.metrics.find((m) => m.key === 'area')?.value).toBe(18);
  });

  it('computes brick / cement / sand quantities with waste + rounding', () => {
    expect(line(result, 'bata_merah').quantity).toBe(1323); // 70 × 18 × 1.05 → ceil
    expect(line(result, 'semen').quantity).toBe(5); // 0.23 × 18 = 4.14 → ceil
    expect(line(result, 'pasir').quantity).toBe(0.77); // 0.043 × 18 → round2
  });

  it('prices the material subtotal from the default price book', () => {
    // 1323×1000 + 5×55000 + 0.77×250000
    expect(result.materialCost).toBe(1_323_000 + 275_000 + 192_500);
    expect(result.labor).toBeNull(); // labour off by default
    expect(result.totalCost).toBe(result.materialCost);
  });
});

describe('unit normalisation end-to-end', () => {
  it('centimetre inputs yield the same result as metre inputs', () => {
    const metric = runCalculation({
      jobId: 'dinding-bata-merah',
      inputs: { panjang: 6, tinggi: 3, bukaan: 0 },
    });
    const centi = runCalculation({
      jobId: 'dinding-bata-merah',
      inputs: { panjang: 600, tinggi: 300, bukaan: 0 },
      units: { panjang: 'cm', tinggi: 'cm' },
    });
    expect(centi.materialCost).toBe(metric.materialCost);
    expect(line(centi, 'bata_merah').quantity).toBe(1323);
  });
});

describe('labour costing', () => {
  it('adds crew cost when enabled', () => {
    const result = runCalculation({
      jobId: 'dinding-bata-merah',
      inputs: { panjang: 6, tinggi: 3, bukaan: 0 },
      labor: { enabled: true, workers: 2, wagePerDay: 150_000 },
    });
    // area 18, productivity 4.5 → 4 man-days ÷ 2 workers = 2 days.
    expect(result.labor).not.toBeNull();
    expect(result.labor?.days).toBe(2);
    expect(result.labor?.cost).toBe(2 * 2 * 150_000);
    expect(result.totalCost).toBe(result.materialCost + result.labor!.cost);
  });
});

describe('select-driven coefficients', () => {
  it('concrete grade changes cement demand', () => {
    const base = { panjang: 3, lebar: 0.15, tebal: 0.3 }; // 0.135 m³
    const k225 = runCalculation({ jobId: 'cor-beton', inputs: { ...base, mutu: 'K225', tulangan: 'none' } });
    const k250 = runCalculation({ jobId: 'cor-beton', inputs: { ...base, mutu: 'K250', tulangan: 'none' } });
    expect(line(k225, 'semen').quantity).toBe(1); // 7.4 × 0.135 → ceil 1
    expect(line(k250, 'semen').quantity).toBe(2); // 8.0 × 0.135 = 1.08 → ceil 2
  });

  it('rebar density drives steel bars only when reinforced', () => {
    const base = { panjang: 3, lebar: 0.15, tebal: 0.3 };
    const none = runCalculation({ jobId: 'cor-beton', inputs: { ...base, tulangan: 'none' } });
    const ringan = runCalculation({ jobId: 'cor-beton', inputs: { ...base, tulangan: 'ringan' } });
    expect(line(none, 'besi_10').quantity).toBe(0);
    expect(line(ringan, 'besi_10').quantity).toBeGreaterThan(0);
  });

  it('paint litres scale with coats', () => {
    const two = runCalculation({ jobId: 'pengecatan', inputs: { panjang: 20, tinggi: 3, bukaan: 0, lapis: '2' } });
    const three = runCalculation({ jobId: 'pengecatan', inputs: { panjang: 20, tinggi: 3, bukaan: 0, lapis: '3' } });
    expect(line(two, 'cat').quantity).toBe(12); // 60 × 2 / 10
    expect(line(three, 'cat').quantity).toBe(18); // 60 × 3 / 10
  });
});

describe('edge cases', () => {
  it('openings larger than the wall clamp area to zero', () => {
    const result = runCalculation({
      jobId: 'dinding-bata-merah',
      inputs: { panjang: 2, tinggi: 2, bukaan: 10 },
    });
    expect(result.metrics.find((m) => m.key === 'area')?.value).toBe(0);
    expect(result.materialCost).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it('price overrides replace default unit prices', () => {
    const result = runCalculation({
      jobId: 'dinding-bata-merah',
      inputs: { panjang: 6, tinggi: 3, bukaan: 0 },
      prices: { semen: 60_000 },
    });
    expect(line(result, 'semen').unitPrice).toBe(60_000);
    expect(line(result, 'semen').cost).toBe(5 * 60_000);
  });
});

describe('validation', () => {
  it('rejects an unknown job with NotFoundError', () => {
    expect(() => runCalculation({ jobId: 'does-not-exist', inputs: {} })).toThrow(NotFoundError);
  });

  it('rejects out-of-range dimensions with a ZodError', () => {
    expect(() =>
      runCalculation({ jobId: 'dinding-bata-merah', inputs: { panjang: 0, tinggi: 3, bukaan: 0 } })
    ).toThrow(z.ZodError);
  });

  it('missing optional inputs fall back to spec defaults', () => {
    const result = runCalculation({ jobId: 'lantai-keramik', inputs: {} });
    // defaults 6 × 4 → 24 m² floor.
    expect(result.metrics.find((m) => m.key === 'area')?.value).toBe(24);
  });
});

describe('client parity', () => {
  it('calculateWithForm matches runCalculation for the same inputs', () => {
    const formula = getFormula('pondasi-batu-kali')!;
    const normalized = normalizeInputs(
      formula,
      { panjang: 42, lebarAtas: 0.3, lebarBawah: 0.6, tinggi: 0.6 },
      {}
    );
    const local = calculateWithForm(formula, normalized);
    const server = runCalculation({
      jobId: 'pondasi-batu-kali',
      inputs: { panjang: 42, lebarAtas: 0.3, lebarBawah: 0.6, tinggi: 0.6 },
    });
    expect(local.totalCost).toBe(server.totalCost);
    expect(local.materials).toEqual(server.materials);
  });
});
