'use client';

import { Field } from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { LENGTH_UNITS } from '../domain/units';
import type { InputSpec, LengthUnit } from '../domain/types';

interface DimensionInputProps {
  spec: InputSpec;
  value: number | string;
  unit: LengthUnit;
  error?: string;
  onValueChange: (value: string) => void;
  onUnitChange: (unit: LengthUnit, previousUnit: LengthUnit) => void;
}

/** Segmented m / cm / mm switch shown beside length fields. */
function UnitToggle({
  value,
  onChange,
}: {
  value: LengthUnit;
  onChange: (unit: LengthUnit, previousUnit: LengthUnit) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Satuan"
      className="inline-flex shrink-0 rounded-lg border border-border bg-muted/40 p-0.5"
    >
      {LENGTH_UNITS.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u, value)}
          aria-pressed={value === u}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
            value === u
              ? 'bg-card text-primary shadow-soft'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

/**
 * Renders one declared input from a formula's spec. It is fully driven by the
 * InputSpec, so new fields appear automatically with no bespoke markup.
 */
export function DimensionInput({
  spec,
  value,
  unit,
  error,
  onValueChange,
  onUnitChange,
}: DimensionInputProps) {
  if (spec.kind === 'select') {
    return (
      <Field label={spec.label} htmlFor={spec.key} error={error} hint={spec.help}>
        <Select
          id={spec.key}
          value={String(value)}
          invalid={!!error}
          onChange={(e) => onValueChange(e.target.value)}
        >
          {(spec.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  const numberField = (
    <Input
      id={spec.key}
      type="number"
      inputMode="decimal"
      value={value === '' ? '' : String(value)}
      min={spec.min}
      max={spec.max}
      step={spec.step ?? (spec.kind === 'count' ? 1 : 'any')}
      invalid={!!error}
      onChange={(e) => onValueChange(e.target.value)}
    />
  );

  return (
    <Field label={spec.label} htmlFor={spec.key} error={error} hint={spec.help}>
      {spec.kind === 'length' ? (
        <div className="flex items-center gap-2">
          <div className="flex-1">{numberField}</div>
          <UnitToggle value={unit} onChange={onUnitChange} />
        </div>
      ) : spec.suffix ? (
        <div className="flex items-center gap-2">
          <div className="flex-1">{numberField}</div>
          <span className="shrink-0 text-sm font-medium text-muted-foreground">{spec.suffix}</span>
        </div>
      ) : (
        numberField
      )}
    </Field>
  );
}
