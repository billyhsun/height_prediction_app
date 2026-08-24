/**
 * Ethnicity values are the stored, language-independent identifiers. Display
 * labels live in the locale dictionaries under `ethnicity`, keyed by these
 * values, so the database never holds translated text.
 */
export const ETHNICITY_VALUES = [
  "east_asian",
  "south_asian",
  "black_african",
  "hispanic_latino",
  "mena",
  "white_european",
  "indigenous",
  "mixed_other",
] as const;

export type EthnicityValue = (typeof ETHNICITY_VALUES)[number];

const ETHNICITY_VALUE_SET = new Set<string>(ETHNICITY_VALUES);

export function sanitizeEthnicities(input: unknown): EthnicityValue[] {
  if (!Array.isArray(input)) return [];
  return input.filter(
    (value): value is EthnicityValue =>
      typeof value === "string" && ETHNICITY_VALUE_SET.has(value),
  );
}

/**
 * `separator` differs by language: English joins with ", " while Chinese uses
 * the ideographic comma "、" for list items.
 */
export function formatEthnicities(
  values: string[],
  labels: Record<EthnicityValue, string>,
  separator = ", ",
): string {
  if (values.length === 0) return "";
  return values
    .map((value) => labels[value as EthnicityValue] ?? value)
    .join(separator);
}
