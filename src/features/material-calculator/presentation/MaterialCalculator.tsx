'use client';

import { useMemo, useState, useCallback } from 'react';
import { AlertTriangle, Save, History, RotateCcw, Trash2 } from 'lucide-react';
import { fieldErrors } from '@/lib/validations';
import { cn, formatCurrency } from '@/lib/utils';
import type { CalculationResult, Formula, LengthUnit } from '../domain/types';
import { FORMULAS, getFormula } from '../configs/material-formulas';
import { normalizeInputs, buildNormalizedSchema } from '../application/dto';
import { calculateWithForm } from '../application/service';
import { JobSelector } from './JobSelector';
import { DimensionInput } from './DimensionInput';
import { ResultCard } from './ResultCard';
import { CostEstimator, type LaborState } from './CostEstimator';
import { useCalculatorHistory, type CalculatorSnapshot } from './useCalculatorHistory';

type RawInputs = Record<string, string>;
type Units = Record<string, LengthUnit>;

/** Seed a form's fields from its formula's declared defaults. */
function defaultsFor(formula: Formula): { inputs: RawInputs; units: Units } {
  const inputs: RawInputs = {};
  const units: Units = {};
  for (const spec of formula.inputs) {
    inputs[spec.key] = String(spec.default);
    if (spec.kind === 'length') units[spec.key] = 'm';
  }
  return { inputs, units };
}

const INITIAL_LABOR: LaborState = { enabled: false, workers: 3, wagePerDay: 150_000 };

export function MaterialCalculator() {
  const [jobId, setJobId] = useState(FORMULAS[0].id);
  const initial = useMemo(() => defaultsFor(FORMULAS[0]), []);
  const [inputs, setInputs] = useState<RawInputs>(initial.inputs);
  const [units, setUnits] = useState<Units>(initial.units);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [labor, setLabor] = useState<LaborState>(INITIAL_LABOR);

  const { entries, add, remove, clear } = useCalculatorHistory();

  const formula = getFormula(jobId) ?? FORMULAS[0];

  // Instant, local calculation on every change — the same engine the API uses.
  const { result, errors } = useMemo<{
    result: CalculationResult | null;
    errors: Record<string, string>;
  }>(() => {
    const normalized = normalizeInputs(formula, inputs, units);
    const parsed = buildNormalizedSchema(formula).safeParse(normalized);
    if (!parsed.success) {
      return { result: null, errors: fieldErrors(parsed.error) };
    }

    const res = calculateWithForm(formula, parsed.data, {
      prices,
      labor: labor.enabled ? { workers: labor.workers, wagePerDay: labor.wagePerDay } : undefined,
    });
    return { result: res, errors: {} };
  }, [formula, inputs, units, prices, labor]);

  const selectJob = useCallback((id: string) => {
    const next = getFormula(id);
    if (!next) return;
    const seed = defaultsFor(next);
    setJobId(id);
    setInputs(seed.inputs);
    setUnits(seed.units);
  }, []);

  const setInputValue = useCallback((key: string, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setUnit = useCallback((key: string, unit: LengthUnit) => {
    setUnits((prev) => ({ ...prev, [key]: unit }));
  }, []);

  const setPrice = useCallback((key: string, value: number) => {
    setPrices((prev) => ({ ...prev, [key]: value }));
  }, []);

  const patchLabor = useCallback((patch: Partial<LaborState>) => {
    setLabor((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetForm = useCallback(() => {
    const seed = defaultsFor(formula);
    setInputs(seed.inputs);
    setUnits(seed.units);
  }, [formula]);

  const saveToHistory = useCallback(() => {
    if (!result) return;
    add({
      jobLabel: result.jobLabel,
      totalCost: result.totalCost,
      snapshot: { jobId, inputs, units },
    });
  }, [add, result, jobId, inputs, units]);

  const restore = useCallback((snapshot: CalculatorSnapshot) => {
    const next = getFormula(snapshot.jobId);
    if (!next) return;
    const seed = defaultsFor(next);
    // Snapshot values are stored loosely (number | string); the form is string-based.
    const restoredInputs: RawInputs = { ...seed.inputs };
    for (const [key, value] of Object.entries(snapshot.inputs)) {
      restoredInputs[key] = String(value);
    }
    setJobId(snapshot.jobId);
    setInputs(restoredInputs);
    setUnits({ ...seed.units, ...(snapshot.units as Units) });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="space-y-6">
      <JobSelector formulas={FORMULAS} selectedId={jobId} onSelect={selectJob} />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        {/* ── Inputs ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">{formula.label}</h2>
                <p className="text-sm text-muted-foreground">{formula.description}</p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {formula.inputs.map((spec) => (
                <DimensionInput
                  key={spec.key}
                  spec={spec}
                  value={inputs[spec.key] ?? ''}
                  unit={units[spec.key] ?? 'm'}
                  error={errors[spec.key]}
                  onValueChange={(v) => setInputValue(spec.key, v)}
                  onUnitChange={(u) => setUnit(spec.key, u)}
                />
              ))}
            </div>
          </div>

          <CostEstimator
            formula={formula}
            prices={prices}
            labor={labor}
            onPriceChange={setPrice}
            onLaborChange={patchLabor}
          />
        </div>

        {/* ── Result ─────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={saveToHistory}
              disabled={!result}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-soft transition-colors hover:bg-muted',
                !result && 'cursor-not-allowed opacity-50 hover:bg-card'
              )}
            >
              <Save className="h-3.5 w-3.5 text-primary" />
              Simpan ke Riwayat
            </button>
          </div>
          {result ? (
            <ResultCard result={result} />
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold">Input belum valid</h3>
                  <p className="mt-1 text-sm text-amber-800">
                    Perbaiki field bertanda merah untuk menampilkan rincian material dan estimasi
                    biaya.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── History ─────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <History className="h-4 w-4 text-primary" />
              Riwayat Perhitungan
            </h3>
            <button
              type="button"
              onClick={clear}
              className="text-xs font-semibold text-red-600 transition-colors hover:text-red-700"
            >
              Hapus semua
            </button>
          </div>
          <ul className="divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <button
                  type="button"
                  onClick={() => restore(e.snapshot)}
                  className="group flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">
                      {e.jobLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                </button>
                <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                  {formatCurrency(e.totalCost)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  aria-label="Hapus riwayat"
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
