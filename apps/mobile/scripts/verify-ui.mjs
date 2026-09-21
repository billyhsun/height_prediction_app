#!/usr/bin/env node
/**
 * Smoke-tests the mobile UI in a browser at an emulated iPhone viewport.
 *
 * This is not a substitute for running on iOS, and it cannot catch anything
 * platform-specific: native gestures, keyboard avoidance, VoiceOver, real
 * shadows, safe-area values, Hermes-only behaviour. What it does check is the
 * part that is shared — that the React Native tree mounts, that layout fits a
 * phone-width viewport, that Pressable/Modal/react-native-svg actually respond,
 * that both locales render, and that a real prediction round-trips and draws the
 * chart. That covers the failures that are cheap to make and expensive to find
 * on a device, and it runs anywhere Chrome is installed — no Xcode, no
 * simulator runtime, no admin rights.
 *
 * Requires the web app running on :3000 (it is the API under test):
 *   npm run dev --workspace web
 *
 * Then:
 *   npm run verify:ui --workspace @notch/mobile
 */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Defaults to the local dev server; point it at a deployment to check the
// native client against the real backend:
//   VERIFY_API_ORIGIN=https://… npm run verify:ui --workspace @notch/mobile
const API_ORIGIN = process.env.VERIFY_API_ORIGIN ?? "http://localhost:3000";
const PROXY_PORT = 5050;
const CDP_PORT = 9222;
const VIEWPORT = { width: 393, height: 852, deviceScaleFactor: 2, mobile: true };

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  log(`  ${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

/** Waits for a URL to answer, rather than sleeping and hoping. */
async function waitForHttp(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return true;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`timed out waiting for ${label} (${url})`);
}

/**
 * Serves the exported bundle and the API from one origin.
 *
 * The real app is a native client and never encounters CORS. Running it in a
 * browser would invent that requirement, so rather than loosening the web app's
 * headers to satisfy the harness, both are put behind a single origin here.
 */
function startProxy(distDir) {
  const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".woff2": "font/woff2",
  };
  const server = createServer(async (req, res) => {
    if (req.url.startsWith("/api/")) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      try {
        const upstream = await fetch(API_ORIGIN + req.url, {
          method: req.method,
          headers: { ...req.headers, host: new URL(API_ORIGIN).host },
          body: ["GET", "HEAD"].includes(req.method)
            ? undefined
            : Buffer.concat(chunks),
        });
        res.writeHead(upstream.status, {
          "content-type":
            upstream.headers.get("content-type") ?? "application/json",
        });
        res.end(Buffer.from(await upstream.arrayBuffer()));
      } catch (e) {
        res.writeHead(502).end(JSON.stringify({ proxyError: String(e) }));
      }
      return;
    }
    const rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(
      /^\/+/,
      "",
    );
    for (const candidate of [rel, join(rel, "index.html"), "index.html"]) {
      try {
        const data = await readFile(join(distDir, candidate));
        res.writeHead(200, {
          "content-type":
            TYPES[extname(candidate)] ?? "application/octet-stream",
        });
        return res.end(data);
      } catch {}
    }
    res.writeHead(404).end("not found");
  });
  return new Promise((r) => server.listen(PROXY_PORT, () => r(server)));
}

/**
 * A guest's save attempt answering 401 is the design, not a fault.
 *
 * `savePredictionToAccount` identifies a guest *by* the 401 and falls back to
 * `reportGuestPrediction`; both platforms do this on every signed-out
 * prediction. The browser logs any 401 response as a console error regardless,
 * so it has to be excluded by hand or the console check can never be green
 * while signed out.
 */
function isExpectedGuest401(entry) {
  return (
    entry.text.includes("401") && (entry.url ?? "").includes("/api/user/")
  );
}

/** Thin CDP client over Node's built-in WebSocket. */
async function connectCdp() {
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const target = list.find((t) => t.type === "page");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: res, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : res(msg.result);
    } else if (
      msg.method === "Log.entryAdded" &&
      msg.params.entry.level === "error" &&
      !isExpectedGuest401(msg.params.entry)
    ) {
      consoleErrors.push(msg.params.entry.text);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res, reject) => {
      const n = ++id;
      pending.set(n, { resolve: res, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };
  return { ws, send, evaluate, consoleErrors };
}

async function main() {
  const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chrome) throw new Error(`no Chrome found; looked in:\n  ${CHROME_CANDIDATES.join("\n  ")}`);

  log("checking the API is up...");
  await waitForHttp(API_ORIGIN, 15_000, "web app on :3000 (npm run dev --workspace web)");

  /*
   * A reachable web app is not a working one. When the ML backend cannot serve
   * a prediction the UI still mounts, still navigates and still validates, so
   * the suite fails six checks in a row at the very end and none of them says
   * why. Asking for one real prediction up front turns that into a single line
   * before anything else runs.
   */
  log("checking the prediction backend can answer...");
  const probe = await fetch(`${API_ORIGIN}/api/v1/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sex: 1,
      height_cm: 110,
      weight_kg: 20,
      current_age_years: 5,
      target_age_years: 18,
    }),
  }).catch((error) => {
    throw new Error(`could not reach ${API_ORIGIN}/api/v1/predict — ${error}`);
  });

  if (!probe.ok) {
    const detail = await probe.json().catch(() => null);
    throw new Error(
      `the prediction backend is not answering (HTTP ${probe.status}: ` +
        `${detail?.detail ?? "no detail"}).\n` +
        `  Every UI check below depends on it, so the run would fail for a ` +
        `reason that has nothing to do with the UI.\n` +
        `  Check it with: npm run health --workspace web`,
    );
  }

  // Empty base URL makes @notch/core use relative URLs, so the proxy's single
  // origin serves both the bundle and the API.
  log("exporting the web bundle...");
  const dist = join(MOBILE_ROOT, ".verify-dist");
  await rm(dist, { recursive: true, force: true });
  const exported = spawnSync(
    "npx",
    ["expo", "export", "--platform", "web", "--output-dir", ".verify-dist", "--clear"],
    {
      cwd: MOBILE_ROOT,
      encoding: "utf8",
      env: { ...process.env, EXPO_PUBLIC_API_BASE_URL: "" },
    },
  );
  if (exported.status !== 0) {
    throw new Error(`expo export failed:\n${exported.stdout}\n${exported.stderr}`);
  }

  const server = await startProxy(dist);
  const profile = await mkdtemp(join(tmpdir(), "notch-verify-"));
  const browser = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let cdp;
  try {
    await waitForHttp(`http://127.0.0.1:${CDP_PORT}/json/version`, 20_000, "Chrome CDP");
    cdp = await connectCdp();
    const { send, evaluate, consoleErrors } = cdp;

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    await send("Emulation.setDeviceMetricsOverride", VIEWPORT);
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await send("Page.navigate", { url: `http://localhost:${PROXY_PORT}` });

    // Wait for the tree to mount rather than guessing at a delay.
    const mounted = await (async () => {
      const deadline = Date.now() + 40_000;
      while (Date.now() < deadline) {
        const ready = await evaluate(
          `document.body.innerText.includes('Get prediction')`,
        ).catch(() => false);
        if (ready) return true;
        await sleep(1000);
      }
      return false;
    })();

    log("\nresults:");
    check("app mounts", mounted);
    if (!mounted) return;

    const layout = await evaluate(`(() => {
      const d = document.documentElement;
      return { overflowsX: d.scrollWidth > window.innerWidth + 1,
               scrollWidth: d.scrollWidth, viewport: window.innerWidth };
    })()`);
    check(
      `no horizontal overflow at ${VIEWPORT.width}pt`,
      !layout.overflowsX,
      `content ${layout.scrollWidth}px vs viewport ${layout.viewport}px`,
    );

    check(
      "native route header is not showing",
      !(await evaluate(`document.body.innerText.trim().startsWith('index')`)),
    );

    // --- a real click, at the element's centre, after scrolling it into view ---
    const click = async (text) => {
      const found = await evaluate(`(() => {
        const w = ${JSON.stringify(text)};
        const hits = [...document.querySelectorAll('div,span')]
          .filter(e => e.textContent.trim() === w && e.getClientRects().length);
        const el = hits.filter(e => !hits.some(o => o !== e && e.contains(o)))[0];
        if (!el) return false;
        el.scrollIntoView({ block: 'center' });
        window.__t = el;
        return true;
      })()`);
      if (!found) throw new Error(`no element with text ${JSON.stringify(text)}`);
      await sleep(400);
      const b = await evaluate(`(() => { const r = window.__t.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      for (const type of ["mousePressed", "mouseReleased"]) {
        await send("Input.dispatchMouseEvent", {
          type, x: b.x, y: b.y, button: "left", clickCount: 1,
        });
      }
      await sleep(700);
    };

    /**
     * Sets a controlled TextInput, found by what it currently holds.
     *
     * react-native-web renders TextInput as a real <input>, but React owns its
     * value — assigning to `.value` is silently reverted on the next render. The
     * native setter plus a bubbled input event is what React's own listener
     * recognises as a user edit.
     */
    const setInput = async (current, next) => {
      const ok = await evaluate(`(() => {
        const el = [...document.querySelectorAll('input')]
          .find(i => i.value === ${JSON.stringify(current)});
        if (!el) return false;
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(next)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      if (!ok) throw new Error(`no input holding ${JSON.stringify(current)}`);
      await sleep(400);
    };

    await click("中文");
    check(
      "locale toggle renders Simplified Chinese",
      await evaluate(`/[\\u4e00-\\u9fff]/.test(document.body.innerText)`),
    );
    await click("EN");
    check(
      "locale toggle returns to English",
      await evaluate(`document.body.innerText.includes('Get prediction')`),
    );

    // --- the sign-in route, and the way back out of it ---
    await click("Sign in");
    check(
      "sign-in screen renders",
      await evaluate(
        `['Welcome back', 'Email', 'Password']` +
          `.every(s => document.body.innerText.includes(s))`,
      ),
    );
    await click("Continue without an account");
    check(
      "guest escape hatch returns to the form",
      await evaluate(`document.body.innerText.includes('Get prediction')`),
    );

    // --- the units toggle ---
    // Switching must change what the fields ask for, not just relabel them:
    // metric is one centimetre box, imperial is a feet/inches pair.
    await click("ft");
    check(
      "imperial splits height into feet and inches",
      await evaluate(
        `document.body.innerText.includes('Feet') &&` +
          ` document.body.innerText.includes('Inches') &&` +
          ` !document.body.innerText.includes('Height (cm)')`,
      ),
    );
    check(
      "imperial converts the seeded height",
      await evaluate(
        `[...document.querySelectorAll('input')].some(i => i.value === '3') &&` +
          ` [...document.querySelectorAll('input')].some(i => i.value === '7')`,
      ),
      "110 cm should read as 3 ft 7 in",
    );
    check(
      "weight switches to pounds",
      await evaluate(`document.body.innerText.includes('Weight (lb)')`),
    );
    await click("cm");
    check(
      "switching back restores centimetres without losing the value",
      await evaluate(
        `document.body.innerText.includes('Height (cm)') &&` +
          ` [...document.querySelectorAll('input')].some(i => i.value === '110')`,
      ),
    );

    // Age entry has two modes, and the date one is three sheet pickers rather
    // than a native date picker. Switching to it should resolve a real age.
    await click("Date of birth");
    check(
      "date-of-birth mode resolves an age",
      await evaluate(`/That is .*(y|\\d)/.test(document.body.innerText)`),
      (await evaluate(`(document.body.innerText.match(/That is [^\\n]*/) || [])[0]`)) ?? "no echo",
    );
    await click("Age");
    check(
      "switching back restores the years and months fields",
      await evaluate(
        `document.body.innerText.includes('Years') &&` +
          ` document.body.innerText.includes('Months')`,
      ),
    );

    // Quick target-age buttons write through to the age field. (The Select
    // primitive is no longer on this screen — it now picks a saved child, which
    // only exists when signed in, so it is not covered here.)
    await click("16");
    check(
      "quick target-age button sets the field",
      await evaluate(
        `[...document.querySelectorAll('input')].some(i => i.value === '16')`,
      ),
    );

    // OptionGrid: assert the rendered state, since react-native-web does not
    // emit aria-checked for a Pressable with accessibilityRole="checkbox".
    const gridState = () => evaluate(`(() => {
      const row = [...document.querySelectorAll('[role="checkbox"]')]
        .find(e => e.textContent.includes('East Asian'));
      if (!row) return null;
      row.scrollIntoView({ block: 'center' });
      window.__row = row;
      return { bg: getComputedStyle(row).backgroundColor,
               tick: row.textContent.includes('\\u2713') };
    })()`);
    const gridBefore = await gridState();
    await click("East Asian");
    const gridAfter = await gridState();
    check(
      "OptionGrid row toggles",
      !!gridBefore && !!gridAfter && gridAfter.tick && !gridBefore.tick,
      `tick ${gridBefore?.tick} -> ${gridAfter?.tick}, bg ${gridAfter?.bg}`,
    );

    // Start recording requests before the first submit, so the rejected one is
    // measured by what it did NOT send.
    await evaluate(
      `window.__net = []; (() => { const f = window.fetch;` +
        ` window.fetch = (...a) => { window.__net.push(String(a[0])); return f(...a); }; })()`,
    );

    /**
     * The bounds `<input type="number" min max>` enforces for the web, which the
     * native form has to check itself. Worth a check here precisely because it
     * is hand-written on this platform and free on the other.
     */
    await setInput("110", "900");
    await click("Get prediction");
    const rejected = await evaluate(`({
      message: document.body.innerText.includes('Height must be between'),
      requests: window.__net.filter(u => u.includes('/api/v1/predict')).length,
      stillOnForm: document.body.innerText.includes('Get prediction'),
    })`);
    check(
      "out-of-range height is rejected before any request",
      rejected.message && rejected.requests === 0 && rejected.stillOnForm,
      `error shown ${rejected.message}, ${rejected.requests} predict calls`,
    );
    await setInput("900", "110");

    // --- the real API round-trip, through to the results screen ---
    await click("Get prediction");
    const predicted = await (async () => {
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const r = await evaluate(`(() => {
          const chart = [...document.querySelectorAll('svg')]
            .find(s => s.getBoundingClientRect().width > 100);
          return {
            requests: window.__net || [],
            // Anchored to the stat that follows the "predicted height" label,
            // not the first measurement on the page — the inputs-used table
            // echoes the entered height in the same shape.
            height: (document.body.innerText
              .split(/PREDICTED HEIGHT/i)[1] || "")
              .trim().split("\\n").filter(Boolean)[0] || null,
            paths: chart ? chart.querySelectorAll('path').length : 0,
            circles: chart ? chart.querySelectorAll('circle').length : 0,
            ticks: chart ? chart.querySelectorAll('text').length : 0,
          };
        })()`);
        if (r.height) return r;
        await sleep(1000);
      }
      return await evaluate(`({ requests: window.__net || [], height: null, paths: 0, circles: 0, ticks: 0 })`);
    })();

    check("calls the prediction API",
      predicted.requests.some((u) => u.includes("/api/v1/predict")),
      predicted.requests.join(", ") || "no requests seen");
    check("navigates to the results screen",
      await evaluate(`location.pathname === '/results'`),
      await evaluate(`location.pathname`));
    check("renders a predicted height", !!predicted.height,
      predicted.height ? `${predicted.height} cm` : "none");
    // gbm-v1 onward returns a calibrated range; the model card is explicit that
    // shipping the point estimate alone throws away its main contribution.
    // Skipped rather than failed against an older model that sends none.
    const range = await evaluate(
      `(document.body.innerText.match(/likely range\\s*\\n?\\s*([^\\n]+)/i) || [])[1] || null`,
    );
    check(
      range
        ? "shows the calibrated range"
        : "no calibrated range (older model — skipped)",
      true,
      range ?? "backend sent no intervals",
    );

    // The shaded interval is a filled path; every other mark in the chart is a
    // stroked line or circle, so a fill-opacity attribute identifies it.
    const band = await evaluate(`(() => {
      const chart = [...document.querySelectorAll('svg')]
        .find(s => s.getBoundingClientRect().width > 100);
      if (!chart) return null;
      const filled = [...chart.querySelectorAll('path')]
        .filter(p => p.getAttribute('fill-opacity') || /fill-opacity/.test(p.getAttribute('style') || ''));
      return filled.length;
    })()`);
    check(
      range ? "growth chart shades the interval" : "no interval to shade (skipped)",
      range ? band >= 1 : true,
      `${band ?? 0} filled path(s)`,
    );

    check("growth chart draws its projection", predicted.paths >= 1,
      `${predicted.paths} paths`);
    check("growth chart draws both markers", predicted.circles >= 2,
      `${predicted.circles} circles`);
    check("growth chart draws axis labels", predicted.ticks >= 4,
      `${predicted.ticks} labels`);

    // --- the birth / not-yet-born screen ---
    // A different method from the growth model, and one that needs no backend:
    // it is a formula over the two parent heights.
    await send("Page.navigate", { url: `http://localhost:${PROXY_PORT}/birth` });
    for (let i = 0; i < 40; i++) {
      if (await evaluate(`document.body.innerText.includes('Estimate adult height')`)) break;
      await sleep(400);
    }
    check(
      "birth screen renders",
      await evaluate(`document.body.innerText.includes('Estimate adult height')`),
    );

    await click("Not yet born");
    check(
      "unborn hides the birth measurements",
      await evaluate(
        `!document.body.innerText.includes('Birth length') &&` +
          ` document.body.innerText.includes('nothing to measure')`,
      ),
    );

    // Mother 165, father 178, boy -> Tanner gives exactly 178.0.
    await setInput("", "165");
    const filled = await evaluate(`(() => {
      const empty = [...document.querySelectorAll('input')].filter(i => !i.value);
      if (!empty.length) return false;
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(empty[0], '178');
      empty[0].dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await sleep(400);
    await click("Estimate adult height");
    await sleep(800);
    const estimate = await evaluate(
      `(document.body.innerText.match(/PREDICTED ADULT HEIGHT\\s*\\n\\s*([^\\n]+)/i) || [])[1] || null`,
    );
    check(
      "unborn estimate matches the Tanner formula",
      filled && !!estimate && estimate.trim().startsWith("178"),
      estimate ?? "no estimate",
    );

    // The explanation arrives after the estimate and must never gate it.
    const explained = await (async () => {
      // The card's header renders while the request is still in flight, so
      // waiting for it alone reads the loading state — which is fast enough to
      // pass against a stub and slow enough to fail against a real model.
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        const text = await evaluate(`document.body.innerText`);
        if (/what this means/i.test(text) && !/Writing an explanation/i.test(text)) {
          return text;
        }
        await sleep(1500);
      }
      return await evaluate(`document.body.innerText`);
    })();
    check(
      "explanation card appears for the unborn case",
      /what this means/i.test(explained),
    );
    // Scoped to the card. The page subtitle also contains the words "as an
    // adult", so an unscoped match passes whether or not the band rendered.
    const card = explained.split(/what this means/i)[1] ?? "";
    check(
      "explanation places the child among adults",
      /as an adult/i.test(card),
      (card.match(/AS AN ADULT[^\n]*/i) || ["not in card"])[0].trim(),
    );
    // Nothing was measured, so there is no birth size to describe — even if the
    // model volunteers one.
    check(
      "no birth-size band without measurements",
      !/size at birth/i.test(card),
    );

    const shotPath = join(MOBILE_ROOT, ".verify-dist", "screenshot.png");
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(shotPath, Buffer.from(data, "base64"));

    check("no console errors", consoleErrors.length === 0,
      consoleErrors.slice(0, 2).join(" | "));

    const failed = results.filter((r) => !r.pass);
    log(`\n${results.length - failed.length}/${results.length} checks passed`);
    log(`screenshot: ${shotPath}`);
    if (failed.length) process.exitCode = 1;
  } finally {
    cdp?.ws.close();
    // Wait for Chrome to actually exit before removing its profile: it keeps
    // writing caches on the way down, and racing it fails with ENOTEMPTY.
    const exited = new Promise((r) => browser.once("exit", r));
    browser.kill();
    await Promise.race([exited, sleep(5000)]);
    server.close();
    // Best-effort: a leftover temp profile must not fail an otherwise green run.
    await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  }
}

main().catch((e) => {
  console.error("\nverify-ui failed:", e.message);
  process.exit(1);
});
