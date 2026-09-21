"use client";

import { useEffect, useRef, useState } from "react";

import {
  CHILD_LIMITS,
  INCHES_PER_FOOT,
  cmFromFeetInches,
  feetInchesFromCm,
  kgToPounds,
  poundsToKg,
  weightUnitLabel,
  type Dictionary,
  type UnitSystem,
} from "@notch/core";

import { Field, Input } from "./Field";

/**
 * Inputs whose displayed unit differs from the one the form holds.
 *
 * The form's state stays canonical — centimetres and kilograms, the units the
 * API takes — and these convert only at the edge. What they must not do is
 * convert on every keystroke: rewriting the field from the canonical value as
 * the user types makes it fight back, because "4" becomes 1.8 kg becomes "4.0"
 * under a cursor that has moved. So each keeps its own display state and emits
 * canonical upward, re-seeding only when a value arrives from somewhere else —
 * an account default loading, or a child profile being picked.
 *
 * Deliberately mirrors apps/mobile/components/ui/MeasurementField.tsx, down to
 * the prop names, so the two forms stay translations of each other.
 */
function useConvertedInput<T>(
  canonical: string,
  seed: (canonical: string) => T,
  emit: (display: T) => string,
  onChange: (canonical: string) => void,
): [T, (next: T) => void] {
  const [display, setDisplay] = useState<T>(() => seed(canonical));
  const lastEmitted = useRef(canonical);

  useEffect(() => {
    if (canonical !== lastEmitted.current) {
      lastEmitted.current = canonical;
      setDisplay(seed(canonical));
    }
    // `seed` is redefined per render by the callers; depending on it would
    // re-seed constantly and undo the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonical]);

  function update(next: T) {
    setDisplay(next);
    const canonicalNext = emit(next);
    lastEmitted.current = canonicalNext;
    onChange(canonicalNext);
  }

  return [display, update];
}

const trimNumber = (value: number): string => String(Number(value.toFixed(2)));

/**
 * One decimal, for a converted value the user never typed.
 *
 * 20 kg is 44.0924 lb, and seeding a field with "44.09" reads as spurious
 * precision. Display only: the canonical kilograms are untouched unless the
 * field is actually edited, so rounding here cannot drift a stored weight.
 */
const trimWeight = (value: number): string => String(Number(value.toFixed(1)));

type Parts = { feet: string; inches: string };

type HeightFieldProps = {
  /** Height in centimetres, as text. Empty string for a blank field. */
  valueCm: string;
  onChangeCm: (cm: string) => void;
  units: UnitSystem;
  t: Dictionary;
  metricLabel: (unit: string) => string;
  groupLabel: string;
  hint?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
};

export function HeightField({
  valueCm,
  onChangeCm,
  units,
  t,
  metricLabel,
  groupLabel,
  hint,
  placeholder,
  required,
}: HeightFieldProps) {
  const [parts, setParts] = useConvertedInput<Parts>(
    valueCm,
    (cm) => {
      if (cm.trim() === "") return { feet: "", inches: "" };
      const split = feetInchesFromCm(Number(cm) || 0);
      return { feet: String(split.feet), inches: String(split.inches) };
    },
    (next) => {
      if (next.feet.trim() === "" && next.inches.trim() === "") return "";
      return trimNumber(
        cmFromFeetInches({
          feet: Number(next.feet) || 0,
          inches: Number(next.inches) || 0,
        }),
      );
    },
    onChangeCm,
  );

  if (units === "metric") {
    return (
      <Field label={metricLabel(t.units.cm)} hint={hint}>
        {({ id }) => (
          <Input
            id={id}
            type="number"
            min={CHILD_LIMITS.heightCm.min}
            max={CHILD_LIMITS.heightCm.max}
            step={0.1}
            required={required}
            value={valueCm}
            placeholder={placeholder}
            onChange={(e) => onChangeCm(e.target.value)}
          />
        )}
      </Field>
    );
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-text-primary">
        {groupLabel}
      </legend>
      {hint && (
        <p className="mb-1.5 text-xs leading-relaxed text-text-secondary">
          {hint}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label={t.units.heightFeetPart}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={0}
              step={1}
              required={required}
              value={parts.feet}
              onChange={(e) => setParts({ ...parts, feet: e.target.value })}
            />
          )}
        </Field>
        <Field label={t.units.heightInchesPart}>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              min={0}
              max={INCHES_PER_FOOT - 1}
              step={0.1}
              value={parts.inches}
              onChange={(e) => setParts({ ...parts, inches: e.target.value })}
            />
          )}
        </Field>
      </div>
    </fieldset>
  );
}

type WeightFieldProps = {
  /** Weight in kilograms, as text. */
  valueKg: string;
  onChangeKg: (kg: string) => void;
  units: UnitSystem;
  t: Dictionary;
  label: (unit: string) => string;
  hint?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
};

export function WeightField({
  valueKg,
  onChangeKg,
  units,
  t,
  label,
  hint,
  placeholder,
  required,
}: WeightFieldProps) {
  const [display, setDisplay] = useConvertedInput<string>(
    valueKg,
    (kg) => (kg.trim() === "" ? "" : trimWeight(kgToPounds(Number(kg) || 0))),
    (pounds) =>
      pounds.trim() === "" ? "" : trimNumber(poundsToKg(Number(pounds) || 0)),
    onChangeKg,
  );

  const imperial = units === "imperial";

  return (
    <Field label={label(weightUnitLabel(units, t))} hint={hint}>
      {({ id }) => (
        <Input
          id={id}
          type="number"
          min={0}
          step={0.1}
          required={required}
          value={imperial ? display : valueKg}
          placeholder={placeholder}
          onChange={(e) =>
            imperial ? setDisplay(e.target.value) : onChangeKg(e.target.value)
          }
        />
      )}
    </Field>
  );
}
