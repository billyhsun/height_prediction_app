/**
 * Adapts the shared design tokens for React Native.
 *
 * Core stores spacing and radii as CSS strings ("16px") because the web needs
 * them that way to generate custom properties. React Native needs numbers. This
 * converts once, so the conversion is not repeated in every StyleSheet and so
 * there is still a single source of truth for the values themselves — change
 * tokens.ts and both platforms move.
 */
import { tokens } from "@notch/core";

const px = (value: string): number => Number.parseInt(value, 10);

const mapPx = <K extends string>(source: Record<K, string>): Record<K, number> =>
  Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, px(value as string)]),
  ) as Record<K, number>;

export const theme = {
  color: tokens.color,
  semantic: tokens.semantic,
  space: mapPx(tokens.space),
  radius: mapPx(tokens.radius),
  control: mapPx(tokens.controlHeight),
  weight: tokens.fontWeight,
} as const;

/**
 * Type scale in points. Core expresses these in rem for the web, which has no
 * meaning here, so the ladder is restated in the units React Native uses. Kept
 * proportional to the web scale (1rem = 16).
 */
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
} as const;

/** iOS shadow presets matching the web's two elevation levels. */
export const elevation = {
  sm: {
    shadowColor: theme.color.neutral[900],
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: theme.color.neutral[900],
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;
