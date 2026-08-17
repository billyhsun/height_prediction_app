export const ETHNICITY_OPTIONS = [
  { value: "east_asian", label: "East Asian" },
  { value: "south_asian", label: "South Asian" },
  { value: "black_african", label: "Black / African" },
  { value: "hispanic_latino", label: "Hispanic / Latino" },
  { value: "mena", label: "Middle Eastern / North African" },
  { value: "white_european", label: "White / European" },
  { value: "indigenous", label: "Indigenous" },
  { value: "mixed_other", label: "Mixed / Other" },
] as const;

export type EthnicityValue = (typeof ETHNICITY_OPTIONS)[number]["value"];

const ETHNICITY_VALUE_SET = new Set<string>(
  ETHNICITY_OPTIONS.map((option) => option.value),
);

export function sanitizeEthnicities(input: unknown): EthnicityValue[] {
  if (!Array.isArray(input)) return [];
  return input.filter(
    (value): value is EthnicityValue =>
      typeof value === "string" && ETHNICITY_VALUE_SET.has(value),
  );
}

export function formatEthnicities(values: string[]): string {
  if (values.length === 0) return "";
  return values
    .map(
      (value) =>
        ETHNICITY_OPTIONS.find((option) => option.value === value)?.label ??
        value,
    )
    .join(", ");
}
