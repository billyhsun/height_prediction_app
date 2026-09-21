#!/usr/bin/env node
/**
 * Checks that a deployment can actually produce a prediction.
 *
 * Exists because the failure it catches is invisible from the outside: the app
 * serves, the form renders, the route handler answers — and every submission
 * returns 502 because the ML backend cannot load its models. Nothing short of
 * running a real prediction distinguishes that from a healthy deploy, which is
 * why it went unnoticed until a user hit it.
 *
 * Deliberately goes through /api/v1/predict rather than straight to the
 * backend: that is the path a user takes, and it covers the proxy, the
 * env vars and the upstream in one call. It needs no credentials, since
 * prediction is open to guests.
 *
 *   node scripts/health-check.mjs                     # localhost:3000
 *   node scripts/health-check.mjs https://your.app    # a deployment
 */

const target = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const TIMEOUT_MS = 30_000;

// A child comfortably inside the model's domain, so a rejection means the
// service is broken rather than the input being unreasonable.
const PROBE = {
  sex: 1,
  height_cm: 110,
  weight_kg: 20,
  current_age_years: 5,
  target_age_years: 18,
};

function fail(message, detail) {
  console.error(`FAIL  ${message}`);
  if (detail) console.error(`      ${detail}`);
  process.exit(1);
}

const started = Date.now();
let res;
try {
  res = await fetch(`${target}/api/v1/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(PROBE),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
} catch (error) {
  fail(`${target} is unreachable`, String(error));
}

const elapsed = Date.now() - started;
const body = await res.json().catch(() => null);

if (!res.ok) {
  // The upstream collapses every internal fault to one message, so echo
  // whatever it said — that string is the only clue the operator gets here,
  // and the UI deliberately no longer shows it.
  fail(
    `prediction failed with HTTP ${res.status} after ${elapsed}ms`,
    body?.detail ?? JSON.stringify(body),
  );
}

const height = Number(body?.pred_height_cm);
if (!Number.isFinite(height) || height < 50 || height > 250) {
  fail("prediction returned an implausible height", JSON.stringify(body));
}

console.log(
  `OK    ${target} predicted ${height.toFixed(1)} cm in ${elapsed}ms ` +
    `(model ${body.model_version})`,
);
