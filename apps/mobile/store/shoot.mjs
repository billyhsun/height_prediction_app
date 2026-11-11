// Store screenshots: renders the mobile app (react-native-web export) in
// headless Chrome, with a status bar drawn on top so each frame reads as a phone.
//   ios:     iPhone 6.9" (440x956pt @3x = 1320x2868px)
//   android: 9:16 at 1080x1920px. Google Play rejects a long side more than
//            twice the short one, so the iPhone frames can't be reused there.
// usage: node shoot.mjs <mobileRoot> <outDir> [skipExport] [ios|android]
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";

const [MOBILE, OUT, SKIP, PLATFORM = "ios"] = process.argv.slice(2);
const ANDROID = PLATFORM === "android";
const API = "https://heightmaxxing-ai.vercel.app"; // same deployment; corp proxy blocks the new domain
const PORT = 5050, CDP = 9233;
const DIST = join(OUT, "..", "dist");
const VIEWPORT = ANDROID
  ? { width: 405, height: 720, deviceScaleFactor: 8 / 3, mobile: true }
  : { width: 440, height: 956, deviceScaleFactor: 3, mobile: true };
const SB = ANDROID ? 32 : 62; // status bar height
const SB_STYLE = ANDROID
  ? "padding:0 18px;font:500 14px Roboto,system-ui;letter-spacing:.2px"
  : "padding:6px 34px 0 52px;font:600 17px -apple-system,system-ui";
const SB_HTML = ANDROID
  ? `<span>12:00</span><span style="display:flex;gap:6px;align-items:center"><svg width="15" height="15" viewBox="0 0 24 24"><path d="M12 21 1 8.5a16 16 0 0 1 22 0z"/></svg><svg width="14" height="14" viewBox="0 0 24 24"><path d="M22 22H2L22 2z"/></svg><svg width="9" height="15" viewBox="0 0 10 16"><rect x="3" y="0" width="4" height="2" rx=".5"/><rect x="0" y="1.5" width="10" height="14.5" rx="1.5"/></svg></span>`
  : `<span>9:41</span><span style="display:flex;gap:7px;align-items:center"><svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.2c2.4 0 4.6.9 6.2 2.5l1.2-1.2C13.9 1.5 11.3.4 8.5.4S3.1 1.5 1.1 3.5l1.2 1.2C3.9 3.1 6.1 2.2 8.5 2.2zm0 3.5c1.4 0 2.7.5 3.7 1.5l1.2-1.2C12.1 4.7 10.4 4 8.5 4S4.9 4.7 3.6 6l1.2 1.2c1-1 2.3-1.5 3.7-1.5zm0 3.5c.5 0 1 .2 1.3.5L8.5 11 7.2 9.7c.3-.3.8-.5 1.3-.5z"/></svg><svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="#000" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2"/><rect x="24.5" y="4.5" width="1.5" height="4" rx=".7" opacity=".4"/></svg></span>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!SKIP) {
  const r = spawnSync("npx", ["expo", "export", "--platform", "web", "--output-dir", DIST, "--clear"],
    { cwd: MOBILE, encoding: "utf8", env: { ...process.env, EXPO_PUBLIC_API_BASE_URL: "" } });
  if (r.status !== 0) throw new Error(r.stdout + r.stderr);
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".ttf": "font/ttf", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  if (req.url.startsWith("/api/guest/")) return res.writeHead(204).end(); // keep prod stats clean
  if (req.url.startsWith("/api/")) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const up = await fetch(API + req.url, { method: req.method,
      headers: { "content-type": req.headers["content-type"] ?? "application/json" },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    res.writeHead(up.status, { "content-type": up.headers.get("content-type") ?? "application/json" });
    return res.end(Buffer.from(await up.arrayBuffer()));
  }
  const rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^\/+/, "");
  for (const c of [rel, join(rel, "index.html"), rel + ".html", "index.html"]) {
    try { const d = await readFile(join(DIST, c)); res.writeHead(200, { "content-type": TYPES[extname(c)] ?? "application/octet-stream" }); return res.end(d); } catch {}
  }
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(PORT, r));

const profile = await mkdtemp(join(tmpdir(), "shots-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--hide-scrollbars", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let list;
for (let i = 0; i < 40; i++) { try { list = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json(); if (list.find((t) => t.type === "page")) break; } catch {} await sleep(500); }
const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pending.has(x.id)) { const p = pending.get(x.id); pending.delete(x.id); x.error ? p.rej(new Error(JSON.stringify(x.error))) : p.res(x.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + JSON.stringify(r.exceptionDetails.exception?.description)); return r.result.value; };
const waitText = async (s, ms = 60000) => { const d = Date.now() + ms; while (Date.now() < d) { if (await ev(`document.body.innerText.includes(${JSON.stringify(s)})`).catch(() => false)) return; await sleep(500); } const {data}=await send("Page.captureScreenshot",{format:"png"}); await writeFile(join(OUT,"debug.png"),Buffer.from(data,"base64")); console.log("BODY:", (await ev("document.body.innerText")).slice(0,500), "\nURL:", await ev("location.href")); throw new Error("timeout waiting for " + s); };
const click = async (text) => {
  const ok = await ev(`(() => { const hits=[...document.querySelectorAll('div,span')].filter(e=>e.textContent.trim()===${JSON.stringify(text)}&&e.getClientRects().length);
    const el=hits.filter(e=>!hits.some(o=>o!==e&&e.contains(o)))[0]; if(!el) return false; el.scrollIntoView({block:'center'}); window.__t=el; return true; })()`);
  if (!ok) throw new Error("no element " + text);
  await sleep(300);
  const b = await ev(`(()=>{const r=window.__t.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: b.x, y: b.y, button: "left", clickCount: 1 });
  await sleep(700);
};
const setInput = async (current, next) => {
  const ok = await ev(`(() => { const el=[...document.querySelectorAll('input')].find(i=>i.value===${JSON.stringify(current)}); if(!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, ${JSON.stringify(next)});
    el.dispatchEvent(new Event('input',{bubbles:true})); el.blur(); return true; })()`);
  if (!ok) throw new Error("no input " + current);
  await sleep(300);
};
// Scroll every scrollable container (RN ScrollView) to the top / to an element.
const scrollTop = () => ev(`[...document.querySelectorAll('*')].forEach(e=>{if(e.scrollHeight>e.clientHeight+2)e.scrollTop=0}); window.scrollTo(0,0)`);
const scrollTo = (text, offset = 0) => ev(`(() => { const hits=[...document.querySelectorAll('div,span')].filter(e=>e.textContent.trim().toLowerCase().startsWith(${JSON.stringify(text.toLowerCase())})&&e.getClientRects().length);
  const el=hits.filter(e=>!hits.some(o=>o!==e&&e.contains(o)))[0]; if(!el) return false;
  let s=el.parentElement; while(s&&!(s.scrollHeight>s.clientHeight+2&&getComputedStyle(s).overflowY!=='visible')) s=s.parentElement;
  if(!s) return false; s.scrollTop += el.getBoundingClientRect().top - ${offset - (62 - SB)}; return true; })()`);
// Platform status bar so the frame reads as a phone screenshot.
const statusBar = () => ev(`(() => {
  if (document.getElementById('__sb')) return;
  const st=document.createElement('style'); st.textContent='#root{position:fixed!important;top:${SB}px!important;left:0;right:0;bottom:0;height:auto!important}';
  document.head.appendChild(st);
  const sb=document.createElement('div'); sb.id='__sb';
  sb.style.cssText='position:fixed;top:0;left:0;right:0;height:${SB}px;z-index:99999;display:flex;align-items:center;justify-content:space-between;${SB_STYLE};color:#000;background:var(--sb,#fff)';
  sb.innerHTML=${JSON.stringify(SB_HTML)};
  document.body.appendChild(sb);
  // match the bar to whatever sits at the top of the app
  const top=document.elementFromPoint(${VIEWPORT.width / 2},${SB + 8}); let n=top,bg='';
  while(n&&n!==document.documentElement){const c=getComputedStyle(n).backgroundColor; if(c&&c!=='rgba(0, 0, 0, 0)'){bg=c;break} n=n.parentElement}
  sb.style.background=bg||'#fff'; document.body.style.background=bg||'#fff';
})()`);
const shot = async (name) => {
  await statusBar(); await sleep(800);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(join(OUT, name + ".png"), Buffer.from(data, "base64"));
  console.log("saved", name);
};
const go = async (path, text) => { await send("Page.navigate", { url: `http://localhost:${PORT}${path}` }); await waitText(text); await sleep(1200); };

await mkdir(OUT, { recursive: true });
try {
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable"); ws.addEventListener("message", m => { const x=JSON.parse(m.data); if (x.method==="Runtime.exceptionThrown"||(x.method==="Log.entryAdded"&&x.params.entry.level==="error")||(x.method==="Runtime.consoleAPICalled"&&x.params.type==="error")) console.log("ERR", JSON.stringify(x.params.exceptionDetails?.exception?.description ?? x.params).slice(0,600)); });
  await send("Emulation.setDeviceMetricsOverride", VIEWPORT);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

  const fillEmpty = (vals) => ev(`(() => { const e=[...document.querySelectorAll('input')].filter(i=>!i.value&&i.getClientRects().length&&getComputedStyle(i).visibility!=='hidden'&&!i.closest('[aria-hidden="true"]'));
    ${JSON.stringify(vals)}.forEach((v,k)=>{ Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e[k],v); e[k].dispatchEvent(new Event('input',{bubbles:true})); }); })()`).then(() => sleep(400));
  const waitRe = (re, ms) => ev(`new Promise(r=>{const d=Date.now()+${ms};(function f(){const t=document.body.innerText;if((${re}).test(t)||Date.now()>d)return r();setTimeout(f,800)})()})`);

  // 1. form
  await go("/", "Get prediction");
  await setInput("110", "112");
  await fillEmpty(["165", "180"]);   // mother, father height
  await scrollTop();
  await shot("01-form");

  // 2-3. results
  await click("Get prediction");
  await waitRe(/predicted height/i, 60000);
  await waitRe(/^(?![\s\S]*(Writing an explanation|Loading|Thinking))/, 90000);
  await sleep(2500);
  await writeFile(join(OUT, "results.txt"), await ev("document.body.innerText"));
  await scrollTop();
  await shot("02-results");
  console.log("scroll03", await scrollTo("height over time", 110));
  await shot("03-results-more");

  // 4-5. baby / unborn
  await go("/", "Get prediction");
  await click("A baby's adult height");
  await waitText("Estimate adult height"); await sleep(1200);
  await click("Not yet born");
  await fillEmpty(["165", "180"]);
  await click("Estimate adult height");
  await waitRe(/what this means/i, 30000);
  await waitRe(/^(?![\s\S]*Writing an explanation)/, 90000);
  await sleep(1500);
  await writeFile(join(OUT, "birth.txt"), await ev("document.body.innerText"));
  await scrollTo("mid-parental", ANDROID ? 190 : 175);
  await shot("04-baby");
} finally {
  ws.close(); chrome.kill(); server.close();
}
