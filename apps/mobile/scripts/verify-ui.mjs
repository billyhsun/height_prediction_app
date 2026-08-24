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
const API_ORIGIN = "http://localhost:3000";
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
          headers: { ...req.headers, host: "localhost:3000" },
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
      msg.params.entry.level === "error"
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

    // Modal-based Select: the sheet should add option rows that were not there.
    const rowsBefore = await evaluate(`[...document.querySelectorAll('div')]
      .filter(e => ['16','18','20'].includes(e.textContent.trim())
                   && !e.children.length && e.getBoundingClientRect().width > 0).length`);
    await click("18");
    const rowsAfter = await evaluate(`[...document.querySelectorAll('div')]
      .filter(e => ['16','18','20'].includes(e.textContent.trim())
                   && !e.children.length && e.getBoundingClientRect().width > 0).length`);
    check("Select opens its modal sheet", rowsAfter > rowsBefore,
      `${rowsBefore} -> ${rowsAfter} option rows`);
    // Dismiss by tapping the backdrop, well above the sheet.
    for (const type of ["mousePressed", "mouseReleased"]) {
      await send("Input.dispatchMouseEvent", {
        type, x: VIEWPORT.width / 2, y: 40, button: "left", clickCount: 1,
      });
    }
    await sleep(700);

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

    // --- the real API round-trip ---
    await evaluate(
      `window.__net = []; (() => { const f = window.fetch;` +
        ` window.fetch = (...a) => { window.__net.push(String(a[0])); return f(...a); }; })()`,
    );
    await click("Get prediction");
    const predicted = await (async () => {
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const r = await evaluate(`(() => {
          const chart = [...document.querySelectorAll('svg')]
            .find(s => s.getBoundingClientRect().width > 100);
          return {
            requests: window.__net || [],
            height: (document.body.innerText.match(/(\\d{2,3}\\.\\d)\\s*cm/) || [])[1] || null,
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
    check("renders a predicted height", !!predicted.height,
      predicted.height ? `${predicted.height} cm` : "none");
    check("growth chart draws its projection", predicted.paths >= 1,
      `${predicted.paths} paths`);
    check("growth chart draws both markers", predicted.circles >= 2,
      `${predicted.circles} circles`);
    check("growth chart draws axis labels", predicted.ticks >= 4,
      `${predicted.ticks} labels`);

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
