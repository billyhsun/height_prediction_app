/**
 * Regenerates src/stature-reference-data.ts from the CDC stature-for-age
 * table.
 *
 * Usage:
 *   node scripts/generate-stature-reference.mjs [path-to-statage.csv]
 *
 * Without an argument it downloads the table from the CDC. The source is the
 * LMS parameterisation of the 2000 CDC growth charts — the same numbers behind
 * every printed pediatric stature-for-age percentile chart:
 *
 *   https://www.cdc.gov/growthcharts/data/zscore/statage.csv
 *
 * The CSV carries a row per half-month; the app needs nowhere near that
 * resolution, so this keeps one row per six months and the runtime
 * interpolates between them. L, M and S vary smoothly with age, which is what
 * makes that safe.
 */

import { writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://www.cdc.gov/growthcharts/data/zscore/statage.csv";
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/stature-reference-data.ts",
);

/** Ages to keep, in months: 24, 30, …, 240. */
const KEPT_MONTHS = Array.from({ length: 37 }, (_, i) => 24 + i * 6);

const csv = process.argv[2]
  ? await readFile(process.argv[2], "utf8")
  : await (await fetch(SOURCE_URL)).text();

const rows = csv
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.split(","))
  .map(([sex, agemos, l, m, s]) => ({
    sex: Number(sex),
    agemos: Number(agemos),
    l: Number(l),
    m: Number(m),
    s: Number(s),
  }))
  .filter((r) => Number.isFinite(r.agemos));

/** L, M and S at an exact month, interpolating the bracketing CSV rows. */
function lmsAt(sex, month) {
  const ofSex = rows
    .filter((r) => r.sex === sex)
    .sort((a, b) => a.agemos - b.agemos);
  let lower = ofSex[0];
  let upper = ofSex[ofSex.length - 1];
  for (const row of ofSex) {
    if (row.agemos <= month) lower = row;
    if (row.agemos >= month) {
      upper = row;
      break;
    }
  }
  if (lower.agemos === upper.agemos) return lower;
  const t = (month - lower.agemos) / (upper.agemos - lower.agemos);
  const lerp = (a, b) => a + (b - a) * t;
  return {
    l: lerp(lower.l, upper.l),
    m: lerp(lower.m, upper.m),
    s: lerp(lower.s, upper.s),
  };
}

const table = (sex) =>
  KEPT_MONTHS.map((month) => {
    const { l, m, s } = lmsAt(sex, month);
    const years = month / 12;
    return `    [${years.toFixed(1)}, ${l.toFixed(5)}, ${m.toFixed(2)}, ${s.toFixed(5)}],`;
  }).join("\n");

const file = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * LMS parameters for stature-for-age from the 2000 CDC growth charts, one row
 * per six months of age from 2 to 20 years. Regenerate with:
 *
 *   node packages/core/scripts/generate-stature-reference.mjs
 *
 * Source: ${SOURCE_URL}
 */

/** [ageYears, L, M, S] — M is the median height in cm at that age. */
export type StatureLmsRow = [number, number, number, number];

export const STATURE_LMS: Record<"male" | "female", StatureLmsRow[]> = {
  male: [
${table(1)}
  ],
  female: [
${table(2)}
  ],
};
`;

writeFileSync(OUT, file);
console.log(`Wrote ${OUT}`);
