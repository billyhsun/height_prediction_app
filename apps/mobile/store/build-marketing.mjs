// Renders App Store marketing images with headless Chrome.
// usage: node build.mjs <screenshotsDir> <iconPath> <outDir>
import { writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const [SHOTS, ICON, OUT] = process.argv.slice(2).map((p) => resolve(p));
const WORK = resolve(OUT, "..", "html");
mkdirSync(OUT, { recursive: true });
mkdirSync(WORK, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const C = { g900: "#0b4438", g800: "#0c5343", g700: "#0b6853", g600: "#0d8266", g500: "#1a9f7d", g300: "#77d7b8", g100: "#d5f5e8", ink: "#18201e" };

const base = `*{margin:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden}
h1,p{text-wrap:balance}
body{font-family:-apple-system,"SF Pro Display",system-ui,sans-serif;-webkit-font-smoothing:antialiased;color:#fff;
background:radial-gradient(120% 70% at 50% 0%, ${C.g600} 0%, ${C.g700} 45%, ${C.g900} 100%)}
.phone{position:relative;background:#0e1413;border-radius:150px;padding:26px;box-shadow:0 60px 120px rgba(0,0,0,.45),0 0 0 3px rgba(255,255,255,.08) inset}
.phone img{display:block;width:100%;border-radius:124px}
.phone::after{content:"";position:absolute;top:58px;left:50%;transform:translateX(-50%);width:250px;height:72px;background:#000;border-radius:40px}`;

// Display photos: headline + phone, 1320x2868
const slides = [
  { shot: "02-results.png", kicker: "ADULT HEIGHT PREDICTION", title: "How tall will<br>your child grow?", sub: "A machine-learning estimate with an 80% likely range." },
  { shot: "03-results-more.png", kicker: "GROWTH CURVE", title: "See the path<br>to adulthood", sub: "Year-by-year projection, plus a second opinion from AI." },
  { shot: "04-baby.png", kicker: "BEFORE BIRTH", title: "Expecting?<br>Start early", sub: "An estimate from both parents' heights, compared with adults." },
  { shot: "01-form.png", kicker: "QUICK & SIMPLE", title: "Done in<br>under a minute", sub: "Age, height and weight. Parents' heights are optional." },
];

const files = [];
slides.forEach((s, i) => {
  const name = `display-${i + 1}`;
  writeFileSync(join(WORK, name + ".html"), `<!doctype html><meta charset="utf-8"><style>${base}
  .wrap{height:100%;display:flex;flex-direction:column;align-items:center;padding-top:190px}
  .kicker{font-size:40px;font-weight:700;letter-spacing:.16em;color:${C.g300}}
  h1{margin-top:34px;font-size:128px;line-height:1.04;font-weight:800;letter-spacing:-.025em;text-align:center}
  p{margin-top:44px;font-size:52px;line-height:1.3;color:rgba(255,255,255,.82);text-align:center;max-width:1060px}
  .phone{margin-top:120px;width:1080px}
  </style><div class="wrap"><div class="kicker">${s.kicker}</div><h1>${s.title}</h1><p>${s.sub}</p>
  <div class="phone"><img src="file://${join(SHOTS, s.shot)}"></div></div>`);
  files.push([name, 1320, 2868]);
});

// Cover photo: 1920x1080 banner
writeFileSync(join(WORK, "cover.html"), `<!doctype html><meta charset="utf-8"><style>${base}
.left{position:absolute;left:130px;top:0;bottom:0;width:820px;display:flex;flex-direction:column;justify-content:center}
.brand{display:flex;align-items:center;gap:34px}
.brand img{width:150px;height:150px;border-radius:34px;box-shadow:0 20px 50px rgba(0,0,0,.35)}
.brand span{font-size:54px;font-weight:700;letter-spacing:-.01em}
h1{margin-top:70px;font-size:104px;line-height:1.04;font-weight:800;letter-spacing:-.025em}
p{margin-top:40px;font-size:40px;line-height:1.35;color:rgba(255,255,255,.82)}
.phone{position:absolute;width:560px;border-radius:80px;padding:14px}
.phone img{border-radius:67px}.phone::after{top:30px;width:135px;height:38px;border-radius:22px}
.p1{left:960px;top:140px;transform:rotate(-6deg)}
.p2{left:1300px;top:290px;transform:rotate(5deg)}
</style>
<div class="left"><div class="brand"><img src="file://${ICON}"><span>Heightmaxxing AI</span></div>
<h1>Predict your child's adult height</h1>
<p>Machine learning, growth curves and percentiles, from a single measurement.</p></div>
<div class="phone p1"><img src="file://${join(SHOTS, "02-results.png")}"></div>
<div class="phone p2"><img src="file://${join(SHOTS, "03-results-more.png")}"></div>`);
files.push(["cover", 1920, 1080]);

for (const [name, w, h] of files) {
  const r = spawnSync(CHROME, ["--headless=new", "--hide-scrollbars", "--allow-file-access-from-files",
    "--force-device-scale-factor=1", `--window-size=${w},${h}`, `--screenshot=${join(OUT, name + ".png")}`,
    "--default-background-color=00000000", `file://${join(WORK, name + ".html")}`], { encoding: "utf8" });
  console.log(name, r.status === 0 ? "ok" : r.stderr.slice(-300));
}
