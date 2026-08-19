/**
 * Generates src/app/tokens.css from src/lib/design/tokens.ts.
 *
 * The TypeScript file is the single source of truth so that React Native and
 * the web cannot drift apart. Rather than restating every value as CSS by hand,
 * this emits Tailwind v4's `@theme` block from the same object the native apps
 * will import.
 *
 * Run with `npm run tokens`. It is also part of `vercel-build`, so a deploy can
 * never ship CSS that lags the tokens.
 *
 * Uses node's --experimental-strip-types (Node >= 22) to import the .ts file
 * directly, which avoids adding a build dependency just to read one object.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const { tokens } = await import(
  path.join(here, "../src/lib/design/tokens.ts")
);

const lines = [];

for (const [family, steps] of Object.entries(tokens.color)) {
  for (const [step, value] of Object.entries(steps)) {
    lines.push(`  --color-${family}-${step}: ${value};`);
  }
}
lines.push("");

// Semantic roles are emitted as colours too, so utilities like `bg-surface`
// and `text-secondary` work directly in JSX.
for (const [role, value] of Object.entries(tokens.semantic)) {
  lines.push(`  --color-${kebab(role)}: ${value};`);
}
lines.push("");

for (const [key, value] of Object.entries(tokens.space)) {
  lines.push(`  --spacing-${key}: ${value};`);
}
lines.push("");

for (const [key, value] of Object.entries(tokens.radius)) {
  lines.push(`  --radius-${key}: ${value};`);
}
lines.push("");

for (const [key, value] of Object.entries(tokens.fontSize)) {
  lines.push(`  --text-${key}: ${value};`);
}
lines.push("");

for (const [key, value] of Object.entries(tokens.fontWeight)) {
  lines.push(`  --font-weight-${key}: ${value};`);
}
lines.push("");

for (const [key, value] of Object.entries(tokens.controlHeight)) {
  lines.push(`  --control-${key}: ${value};`);
}
lines.push("");

for (const [key, value] of Object.entries(tokens.shadow)) {
  lines.push(`  --shadow-${key}: ${value};`);
}

function kebab(value) {
  return value.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

const css = `/* GENERATED FILE — DO NOT EDIT.
 * Source: src/lib/design/tokens.ts
 * Regenerate: npm run tokens
 */

@theme {
${lines.join("\n")}
}
`;

const out = path.join(here, "../src/app/tokens.css");
writeFileSync(out, css);
console.log(`Wrote ${path.relative(process.cwd(), out)} (${lines.filter(Boolean).length} tokens)`);
