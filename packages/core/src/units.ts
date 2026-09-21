/**
 * Metric and imperial display, over a codebase that is metric underneath.
 *
 * Centimetres and kilograms remain the canonical unit everywhere that matters:
 * the prediction API takes `height_cm` and `weight_kg`, every stored row is in
 * those units, and the model was trained on them. Nothing here changes that.
 * This module converts at the two edges only — what a field reads back, and
 * what a label prints — so a preference that is per-device, and can change
 * between two viewings of the same saved prediction, can never alter what the
 * prediction actually was.
 *
 * Pure functions, no DOM and no React, so React Native reuses this verbatim.
 */

import type { Dictionary } from "./i18n/dictionaries";

export const UNIT_SYSTEMS = ["metric", "imperial"] as const;

export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const DEFAULT_UNIT_SYSTEM: UnitSystem = "metric";

/** Cookie name, mirroring LOCALE_COOKIE. Read server-side so the first paint
 *  is already in the right units. */
export const UNITS_COOKIE = "units";

export const UNITS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isUnitSystem(value: unknown): value is UnitSystem {
  return (
    typeof value === "string" && (UNIT_SYSTEMS as readonly string[]).includes(value)
  );
}

export function resolveUnitSystem(value: unknown): UnitSystem {
  return isUnitSystem(value) ? value : DEFAULT_UNIT_SYSTEM;
}

// Exact by definition, both of them — the inch and the pound are *defined* in
// terms of the metre and the kilogram, so these are not approximations.
const CM_PER_INCH = 2.54;
const KG_PER_POUND = 0.45359237;

export const INCHES_PER_FOOT = 12;

export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH;
}

export function inchesToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

export function kgToPounds(kg: number): number {
  return kg / KG_PER_POUND;
}

export function poundsToKg(pounds: number): number {
  return pounds * KG_PER_POUND;
}

export type FeetInches = { feet: number; inches: number };

/**
 * Splits a height into whole feet and leftover inches.
 *
 * The total is rounded to the nearest inch *before* it is split, so a height
 * that rounds up through a foot boundary carries properly: 11.7 inches becomes
 * 1'0", never 0'12".
 */
export function feetInchesFromCm(cm: number): FeetInches {
  const totalInches = Math.round(cmToInches(cm));
  return {
    feet: Math.floor(totalInches / INCHES_PER_FOOT),
    inches: totalInches % INCHES_PER_FOOT,
  };
}

export function cmFromFeetInches({ feet, inches }: FeetInches): number {
  return inchesToCm(feet * INCHES_PER_FOOT + inches);
}

/**
 * A measurement ready to render: the number as text, and the unit beside it.
 *
 * Split rather than pre-joined because the Stat primitive sets them in
 * different sizes. Imperial height carries its units inside the value — 5'9"
 * has no trailing word — so `unit` is absent there rather than empty.
 */
export type Measurement = { value: string; unit?: string };

export function heightMeasurement(
  cm: number,
  system: UnitSystem,
  t: Dictionary,
): Measurement {
  if (system === "imperial") {
    const { feet, inches } = feetInchesFromCm(cm);
    return { value: t.units.heightImperial(feet, inches) };
  }
  return { value: cm.toFixed(1), unit: t.units.cm };
}

export function weightMeasurement(
  kg: number,
  system: UnitSystem,
  t: Dictionary,
): Measurement {
  if (system === "imperial") {
    return { value: kgToPounds(kg).toFixed(1), unit: t.units.lb };
  }
  return { value: kg.toFixed(1), unit: t.units.kg };
}

const joined = (measurement: Measurement): string =>
  measurement.unit ? `${measurement.value} ${measurement.unit}` : measurement.value;

/** The same values as one string, for prose and table cells. */
export function formatHeight(
  cm: number,
  system: UnitSystem,
  t: Dictionary,
): string {
  return joined(heightMeasurement(cm, system, t));
}

export function formatWeight(
  kg: number,
  system: UnitSystem,
  t: Dictionary,
): string {
  return joined(weightMeasurement(kg, system, t));
}

/**
 * A height as a bare number in whatever unit is being displayed.
 *
 * For the growth chart, which plots and tick-labels raw numbers and has no idea
 * what they mean. Converting the points rather than teaching the chart about
 * units keeps it unit-agnostic, and means the axis ticks come out in inches
 * instead of centimetres that happen to be labelled "in".
 */
export function heightInDisplayUnit(cm: number, system: UnitSystem): number {
  return system === "imperial" ? cmToInches(cm) : cm;
}

/** Unit word for an axis label or a field suffix, without any number. */
export function heightUnitLabel(system: UnitSystem, t: Dictionary): string {
  return system === "imperial" ? t.units.in : t.units.cm;
}

export function weightUnitLabel(system: UnitSystem, t: Dictionary): string {
  return system === "imperial" ? t.units.lb : t.units.kg;
}
