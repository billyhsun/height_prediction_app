// Renders captioned Google Play phone screenshots (1080x1920, 9:16) with headless Chrome.
// usage: node build-play-screenshots.mjs <androidScreenshotsDir> <outDir>
// Input: the raw Android captures from `node shoot.mjs android` (1080x1920).
import { writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const [SHOTS, OUT] = process.argv.slice(2).map((p) => resolve(p));
const WORK = resolve(OUT, "..", "html-play");
mkdirSync(OUT, { recursive: true });
mkdirSync(WORK, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const W = 1080;
const H = 1920;

const C = { g900: "#0b4438", g700: "#0b6853", g600: "#0d8266", g300: "#77d7b8" };

const slides = [
  { shot: "02-results.png", kicker: "ADULT HEIGHT PREDICTION", title: "How tall will your child grow?", sub: "A machine-learning estimate with an 80% likely range." },
  { shot: "03-results-more.png", kicker: "GROWTH CURVE", title: "See the path to adulthood", sub: "Year-by-year projection, plus a second opinion from AI." },
  { shot: "04-baby.png", kicker: "BEFORE BIRTH", title: "Expecting? Start early", sub: "An estimate from both parents' heights." },
  { shot: "01-form.png", kicker: "QUICK & SIMPLE", title: "Done in under a minute", sub: "Age, height and weight. Parents' heights are optional." },
];

slides.forEach((s, i) => {
  const name = `play-${i + 1}`;
  const html = `<!doctype html><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden}
h1,p{text-wrap:balance}
body{font-family:-apple-system,"SF Pro Display",system-ui,sans-serif;-webkit-font-smoothing:antialiased;color:#fff;
background:radial-gradient(120% 70% at 50% 0%, ${C.g600} 0%, ${C.g700} 45%, ${C.g900} 100%)}
.wrap{height:100%;display:flex;flex-direction:column;align-items:center;padding-top:110px}
.kicker{font-size:30px;font-weight:700;letter-spacing:.16em;color:${C.g300}}
h1{margin-top:24px;font-size:84px;line-height:1.05;font-weight:800;letter-spacing:-.025em;text-align:center;max-width:920px}
p{margin-top:28px;font-size:38px;line-height:1.3;color:rgba(255,255,255,.82);text-align:center;max-width:880px}
.phone{position:absolute;top:540px;left:140px;width:800px;background:#0e1413;border-radius:64px;padding:16px;
box-shadow:0 40px 90px rgba(0,0,0,.45),0 0 0 2px rgba(255,255,255,.08) inset}
.phone img{display:block;width:100%;border-radius:50px}
.phone::after{content:"";position:absolute;top:34px;left:50%;transform:translateX(-50%);width:30px;height:30px;background:#000;border-radius:50%}
</style><div class="wrap"><div class="kicker">${s.kicker}</div><h1>${s.title}</h1><p>${s.sub}</p>
<div class="phone"><img src="file://${join(SHOTS, s.shot)}"></div></div>`;
  const htmlPath = join(WORK, name + ".html");
  writeFileSync(htmlPath, html);
  const r = spawnSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
    "--force-device-scale-factor=1", `--window-size=${W},${H}`,
    `--screenshot=${join(OUT, name + ".png")}`, `file://${htmlPath}`,
  ], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log("wrote", name + ".png");
});
