import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  cmFromFeetInches,
  cmToInches,
  feetInchesFromCm,
  inchesToCm,
  heightUnitLabel,
  kgToPounds,
  poundsToKg,
  weightUnitLabel,
  type Dictionary,
  type UnitSystem,
} from "@notch/core";

import { Field, Input } from "./Field";
import { theme } from "./theme";

/**
 * Inputs whose displayed unit differs from the one the form holds.
 *
 * The form's state stays canonical — centimetres and kilograms, the units the
 * API takes — and these components convert only at the edge. What they must not
 * do is convert on every keystroke: rewriting the field from the canonical
 * value as the user types makes it fight back, because "4" becomes 1.8 kg
 * becomes "4.0" under a cursor that has moved. So each keeps its own display
 * state and emits canonical upward, re-seeding only when a value arrives from
 * somewhere else — an account default loading, or a child profile being picked.
 */
function useConvertedInput<T>(
  canonical: string,
  seed: (canonical: string) => T,
  emit: (display: T) => string,
  onChange: (canonical: string) => void,
): [T, (next: T) => void] {
  const [display, setDisplay] = useState<T>(() => seed(canonical));
  // What this field last sent up. Anything different arriving in `canonical`
  // came from elsewhere and should overwrite what is on screen.
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

type HeightFieldProps = {
  /** Height in centimetres, as text. Empty string for a blank field. */
  valueCm: string;
  onChangeCm: (cm: string) => void;
  units: UnitSystem;
  t: Dictionary;
  /** Shown in metric as "Height (cm)"; in imperial it heads the ft/in pair. */
  metricLabel: (unit: string) => string;
  groupLabel: string;
  hint?: string;
  placeholder?: string;
};

type Parts = { feet: string; inches: string };

export function HeightField({
  valueCm,
  onChangeCm,
  units,
  t,
  metricLabel,
  groupLabel,
  hint,
  placeholder,
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
        {() => (
          <Input
            keyboardType="decimal-pad"
            value={valueCm}
            onChangeText={onChangeCm}
            placeholder={placeholder}
          />
        )}
      </Field>
    );
  }

  return (
    <Field label={groupLabel} hint={hint}>
      {() => (
        <View style={styles.pair}>
          <View style={styles.part}>
            <Field label={t.units.heightFeetPart}>
              {() => (
                <Input
                  keyboardType="number-pad"
                  value={parts.feet}
                  onChangeText={(feet) => setParts({ ...parts, feet })}
                />
              )}
            </Field>
          </View>
          <View style={styles.part}>
            <Field label={t.units.heightInchesPart}>
              {() => (
                <Input
                  keyboardType="decimal-pad"
                  value={parts.inches}
                  onChangeText={(inches) => setParts({ ...parts, inches })}
                />
              )}
            </Field>
          </View>
        </View>
      )}
    </Field>
  );
}

type WeightFieldProps = {
  /** Weight in kilograms, as text. */
  valueKg: string;
  onChangeKg: (kg: string) => void;
  units: UnitSystem;
  t: Dictionary;
  label: (unit: string) => string;
  hint?: string;
  placeholder?: string;
};

export function WeightField({
  valueKg,
  onChangeKg,
  units,
  t,
  label,
  hint,
  placeholder,
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
      {() => (
        <Input
          keyboardType="decimal-pad"
          value={imperial ? display : valueKg}
          onChangeText={imperial ? setDisplay : onChangeKg}
          placeholder={placeholder}
        />
      )}
    </Field>
  );
}

/** Re-exported so screens can label a chart axis without importing core. */
export { heightUnitLabel, weightUnitLabel };

const styles = StyleSheet.create({
  pair: { flexDirection: "row", gap: theme.space[3] },
  part: { flex: 1 },
});

type LengthFieldProps = {
  /** Length in centimetres, as text. */
  valueCm: string;
  onChangeCm: (cm: string) => void;
  units: UnitSystem;
  t: Dictionary;
  label: (unit: string) => string;
  hint?: string;
  placeholder?: string;
};

/**
 * A single length field that switches between centimetres and plain inches.
 *
 * Distinct from HeightField, which splits imperial into feet and inches. That
 * is right for a person's height and wrong for a newborn: a baby's length is
 * quoted as "20 inches", never "1 foot 8".
 */
export function LengthField({
  valueCm,
  onChangeCm,
  units,
  t,
  label,
  hint,
  placeholder,
}: LengthFieldProps) {
  const [display, setDisplay] = useConvertedInput<string>(
    valueCm,
    (cm) => (cm.trim() === "" ? "" : trimWeight(cmToInches(Number(cm) || 0))),
    (inches) =>
      inches.trim() === "" ? "" : trimNumber(inchesToCm(Number(inches) || 0)),
    onChangeCm,
  );

  const imperial = units === "imperial";

  return (
    <Field label={label(imperial ? t.units.in : t.units.cm)} hint={hint}>
      {() => (
        <Input
          keyboardType="decimal-pad"
          value={imperial ? display : valueCm}
          onChangeText={imperial ? setDisplay : onChangeCm}
          placeholder={placeholder}
        />
      )}
    </Field>
  );
}
