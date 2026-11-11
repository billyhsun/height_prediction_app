// App Store product page header / search result banners.
// usage: node banners.mjs <screenshotsDir> <iconPath> <outDir>
import { writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const [SHOTS, ICON, OUT] = process.argv.slice(2).map((p) => resolve(p));
const WORK = resolve(OUT, "..", "html");
mkdirSync(OUT, { recursive: true });
mkdirSync(WORK, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// [file, css width, css height, device scale, platform]
const SIZES = [
  ["header-21x9", 1920, 823, 2],    // App Store 3840 x 1646
  ["search-3x2", 1920, 1280, 2],    // App Store 3840 x 2560
  ["banner-16x9", 2622, 1475, 2],   // App Store 5244 x 2950
  // Google Play: Android screenshots in a punch-hole frame, not iPhones.
  ["play-feature-graphic", 1024, 500, 1, "android"],
];

for (const [name, W, H, SCALE, platform = "ios"] of SIZES) {
  const android = platform === "android";
  const shots = android ? resolve(SHOTS, "..", "android", "screenshots") : SHOTS;
  const pw = Math.round(Math.min(0.52 * H, 0.3 * W));            // phone width
  const p2 = Math.round(W - pw * 1.05);       // back-right phone
  const p1 = Math.round(p2 - pw * 0.62);      // front-left phone
  const padL = Math.round(Math.min(W * 0.068, H * 0.12));
  const textW = p1 - padL - Math.round(H * 0.04);
  const h1 = Math.round(Math.min(H * 0.1, textW * 0.165));
  const r = pw / 560; // frame details were tuned at a 560px phone

  writeFileSync(join(WORK, name + ".html"), `<!doctype html><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden}
body{font-family:-apple-system,"SF Pro Display",system-ui,sans-serif;-webkit-font-smoothing:antialiased;color:#fff;
background:radial-gradient(120% 90% at 35% 0%, #0d8266 0%, #0b6853 45%, #0b4438 100%)}
h1,p{text-wrap:balance}
.left{position:absolute;left:${padL}px;top:0;bottom:0;width:${textW}px;display:flex;flex-direction:column;justify-content:center}
.brand{display:flex;align-items:center;gap:${Math.round(H * 0.03)}px}
.brand img{width:${Math.round(H * 0.13)}px;height:${Math.round(H * 0.13)}px;border-radius:${Math.round(H * 0.03)}px;box-shadow:0 ${Math.round(H * 0.018)}px ${Math.round(H * 0.045)}px rgba(0,0,0,.35)}
.brand span{white-space:nowrap;font-size:${Math.round(H * 0.048)}px;font-weight:700}
h1{margin-top:${Math.round(H * 0.06)}px;font-size:${h1}px;line-height:1.04;font-weight:800;letter-spacing:-.025em}
p{margin-top:${Math.round(H * 0.035)}px;font-size:${Math.round(h1 * 0.38)}px;line-height:1.35;color:rgba(255,255,255,.82)}
.phone{position:absolute;width:${pw}px;background:#0e1413;border-radius:${(android ? 56 : 80) * r}px;padding:${14 * r}px;box-shadow:0 ${50 * r}px ${100 * r}px rgba(0,0,0,.45),0 0 0 ${2 * r}px rgba(255,255,255,.08) inset}
.phone img{display:block;width:100%;border-radius:${(android ? 43 : 67) * r}px}
.phone::after{content:"";position:absolute;top:${30 * r}px;left:50%;transform:translateX(-50%);${android
    ? `width:${30 * r}px;height:${30 * r}px;border-radius:50%`
    : `width:${135 * r}px;height:${38 * r}px;border-radius:${22 * r}px`};background:#000}
.p1{left:${p1}px;top:${Math.round(H * 0.13)}px;transform:rotate(-6deg)}
.p2{left:${p2}px;top:${Math.round(H * 0.27)}px;transform:rotate(5deg)}
</style>
<div class="left"><div class="brand"><img src="file://${ICON}"><span>Heightmaxxing AI</span></div>
<h1>Predict your child's adult height</h1>
<p>Machine learning, growth curves and percentiles, from a single measurement.</p></div>
<div class="phone p1"><img src="file://${join(shots, "02-results.png")}"></div>
<div class="phone p2"><img src="file://${join(shots, "03-results-more.png")}"></div>`);

  const res = spawnSync(CHROME, ["--headless=new", "--hide-scrollbars", "--allow-file-access-from-files",
    `--force-device-scale-factor=${SCALE}`, `--window-size=${W},${H}`,
    `--screenshot=${join(OUT, name + ".png")}`, `file://${join(WORK, name + ".html")}`], { encoding: "utf8" });
  console.log(name, res.status === 0 ? "ok" : res.stderr.slice(-300));
}
