/**
 * Design tokens — the single source of truth for the visual system.
 *
 * WHY THIS FILE IS PLAIN TYPESCRIPT
 *
 * Tailwind utility classes do not exist in React Native, so nothing written as
 * `bg-slate-100` can be reused by the mobile apps. A plain object can: React
 * Native imports this file directly and feeds the same values into StyleSheet.
 *
 * The web side does not read these values twice. `scripts/build-tokens.mjs`
 * generates `src/app/tokens.css` from this file, so the CSS custom properties
 * and Tailwind's `@theme` are derived from it rather than restating it. Edit
 * here, run `npm run tokens`, and both platforms move together.
 *
 * The palette is built around growth: a teal-green primary for the product's
 * own actions, and a distinct plum for LLM output so the two prediction sources
 * are never confused for one another.
 */

export const color = {
  // Neutrals carry a faint green cast so they sit with the primary rather than
  // fighting it. A pure grey next to a teal accent reads as unconsidered.
  neutral: {
    0: "#ffffff",
    50: "#f7f9f8",
    100: "#eef1f0",
    200: "#dfe5e3",
    300: "#c6cfcc",
    400: "#9aa8a4",
    500: "#71807c",
    600: "#56635f",
    700: "#414c49",
    800: "#2b3432",
    900: "#18201e",
  },
  // Primary: growth, health, forward motion.
  primary: {
    50: "#eefbf6",
    100: "#d5f5e8",
    200: "#aeead4",
    300: "#77d7b8",
    400: "#3fbc98",
    500: "#1a9f7d",
    600: "#0d8266",
    700: "#0b6853",
    800: "#0c5343",
    900: "#0b4438",
  },
  // Reserved for LLM-derived output, so it is visually separable from the ML
  // model's numbers at a glance.
  accent: {
    50: "#f8f2fb",
    100: "#f0e3f7",
    200: "#e2c9ef",
    500: "#8b4bb0",
    600: "#74399a",
    700: "#5d2d7c",
  },
  success: { 50: "#eaf7ee", 600: "#17803d", 700: "#146430" },
  warning: { 50: "#fdf4e3", 600: "#b45309", 700: "#92400e" },
  danger: { 50: "#fdeeee", 600: "#c02626", 700: "#9d1f1f" },
  info: { 50: "#eef4fd", 600: "#1d68d6", 700: "#1854ac" },
} as const;

/** Semantic roles. Components reference these, never raw palette steps, so a
 *  palette change does not require touching every component. */
export const semantic = {
  canvas: color.neutral[50],
  surface: color.neutral[0],
  surfaceSunk: color.neutral[100],
  border: color.neutral[200],
  borderStrong: color.neutral[300],
  textPrimary: color.neutral[900],
  textSecondary: color.neutral[600],
  textMuted: color.neutral[500],
  textOnPrimary: color.neutral[0],
} as const;

/** 4pt base — the grid React Native layouts use natively. */
export const space = {
  0: "0px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
} as const;

export const radius = {
  sm: "6px",
  md: "10px",
  lg: "14px",
  xl: "20px",
  full: "9999px",
} as const;

export const fontSize = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
} as const;

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/**
 * Control heights. `md` is 44px because that is Apple's minimum touch target —
 * honouring it now costs nothing and avoids resizing every control when the
 * native apps ship.
 */
export const controlHeight = {
  sm: "36px",
  md: "44px",
  lg: "52px",
} as const;

export const shadow = {
  sm: "0 1px 2px 0 rgb(24 32 30 / 0.05)",
  md: "0 4px 12px -2px rgb(24 32 30 / 0.08), 0 2px 4px -2px rgb(24 32 30 / 0.04)",
  lg: "0 12px 28px -6px rgb(24 32 30 / 0.12), 0 4px 8px -4px rgb(24 32 30 / 0.06)",
} as const;

export const tokens = {
  color,
  semantic,
  space,
  radius,
  fontSize,
  fontWeight,
  controlHeight,
  shadow,
} as const;

export type Tokens = typeof tokens;
