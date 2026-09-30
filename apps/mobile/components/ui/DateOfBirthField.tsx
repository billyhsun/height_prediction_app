import { StyleSheet, View } from "react-native";

import { MAX_MODEL_CURRENT_AGE, MONTHS_PER_YEAR } from "@notch/core";

import { Field, Select } from "./Field";
import { theme } from "./theme";

export type DobParts = { year: string; month: string; day: string };

const pad = (value: string) => value.padStart(2, "0");

/** "YYYY-MM-DD", the shape a DATE column and core's age helpers both expect. */
export const dobToIso = (dob: DobParts) =>
  `${dob.year}-${pad(dob.month)}-${pad(dob.day)}`;

export function dobFromIso(iso: string): DobParts {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return {
    year: year ?? "",
    month: String(Number(month ?? "1")),
    day: String(Number(day ?? "1")),
  };
}

/** Days in a month, so February and the 30-day months cannot offer a 31st. */
export function daysInMonth(year: string, month: string): number {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return 31;
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

const optionsOf = (values: string[]) =>
  values.map((value) => ({ value, label: value }));

export function defaultDob(yearsAgo = 5): DobParts {
  return { year: String(new Date().getFullYear() - yearsAgo), month: "1", day: "1" };
}

type DateOfBirthFieldProps = {
  value: DobParts;
  onChange: (next: DobParts) => void;
  label: string;
  hint?: string;
  /** How far back the year list reaches. The prediction form only wants ages
   *  the model can answer for; a child profile outlives that. */
  yearsBack?: number;
};

/**
 * Date of birth as three sheet pickers.
 *
 * Not @react-native-community/datetimepicker: that would pull in a native
 * module the Expo Go client would have to ship, and it has no
 * react-native-web build — which is what scripts/verify-ui.mjs renders the
 * tree with, so the smoke test would go blind on every screen using it. Select
 * is already the project's answer to "there is no native <select>".
 *
 * Extracted from the prediction form when the child profile form needed the
 * same control; the day-clamping below is the part worth not writing twice.
 */
export function DateOfBirthField({
  value,
  onChange,
  label,
  hint,
  yearsBack = MAX_MODEL_CURRENT_AGE,
}: DateOfBirthFieldProps) {
  const thisYear = new Date().getFullYear();

  return (
    <Field label={label} hint={hint}>
      {() => (
        <View style={styles.row}>
          <View style={styles.year}>
            <Select
              value={value.year}
              onChange={(year) => onChange({ ...value, year })}
              accessibilityLabel={label}
              options={optionsOf(range(thisYear - yearsBack, thisYear).reverse())}
            />
          </View>
          <View style={styles.part}>
            <Select
              value={value.month}
              onChange={(month) =>
                onChange({
                  ...value,
                  month,
                  // Clamp the day, or switching to February would leave a 31st
                  // selected and produce an invalid date.
                  day: String(
                    Math.min(Number(value.day), daysInMonth(value.year, month)),
                  ),
                })
              }
              accessibilityLabel={label}
              options={optionsOf(range(1, MONTHS_PER_YEAR))}
            />
          </View>
          <View style={styles.part}>
            <Select
              value={value.day}
              onChange={(day) => onChange({ ...value, day })}
              accessibilityLabel={label}
              options={optionsOf(range(1, daysInMonth(value.year, value.month)))}
            />
          </View>
        </View>
      )}
    </Field>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: theme.space[2] },
  // The year is four digits against two, so it gets the extra width.
  year: { flex: 1.4 },
  part: { flex: 1 },
});
