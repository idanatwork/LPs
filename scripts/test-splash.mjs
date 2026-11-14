import { webkit } from "playwright-core";
import { mkdirSync } from "fs";

const base = process.env.BASE_URL || "http://127.0.0.1:8765";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const G = "\u05f4";
const lines = [
  "לעילוי נשמת",
  `עדי עדיאל טויטו הי${G}ד`,
  `בת אילנה ויורם שיבל${G}ט`,
  "שנרצחה על קידוש השם בטבח שמחת תורה",
  `כ${G}ב בתשרי תשפ${G}ד`,
  "ת.נ.צ.ב.ה.",
];
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

mkdirSync("/opt/cursor/artifacts", { recursive: true });
const browser = await webkit.launch();

async function open(reduced) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: iphone,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("tefila-theme", "dark"));
  await page.goto(base + "/tefila/shacharit.html", { waitUntil: "domcontentloaded" });
  return { context, page };
}

async function opacity(page) {
  return page.evaluate(() => {
    const el = document.getElementById("memorial-splash");
    if (!el) return null;
    return parseFloat(getComputedStyle(el).opacity);
  });
}

const shown = await open(false);
const splash = shown.page.locator("#memorial-splash");
check("splash is visible on load", await splash.isVisible());
const fadeIn = await shown.page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".memorial-card")).opacity));
check("dedication text fades in", fadeIn > 0 && fadeIn < 1, fadeIn.toFixed(2));
const got = await splash.locator("p").allInnerTexts();
check("dedication text is exact", got.join("\n") === lines.join("\n"), got.join(" | "));
check("splash shows no English letters", !/[A-Za-z]/.test(await splash.innerText()));
await shown.page.waitForTimeout(600);
await splash.screenshot({ path: "/opt/cursor/artifacts/memorial-splash-iphone.png" });
await shown.context.close();

async function fadeSamples(reduced, label) {
  const session = await open(reduced);
  const page = session.page;
  await page.waitForTimeout(400);
  const trace = await page.evaluate(() => new Promise((resolve) => {
    const splash = document.getElementById("memorial-splash");
    splash.click();
    const samples = [];
    let moved = "gone";
    const started = performance.now();
    (function tick() {
      const node = document.getElementById("memorial-splash");
      const opacityNow = node ? parseFloat(getComputedStyle(node).opacity) : null;
      const card = node && node.querySelector(".memorial-card");
      if (card && opacityNow != null && opacityNow < 0.8 && moved === "gone") moved = getComputedStyle(card).transform;
      samples.push({ t: Math.round(performance.now() - started), o: opacityNow });
      if (performance.now() - started < 1300) requestAnimationFrame(tick);
      else resolve({ samples, moved });
    })();
  }));
  const near = (ms) => trace.samples.reduce((best, sample) => Math.abs(sample.t - ms) < Math.abs(best.t - ms) ? sample : best);
  const at400 = near(400);
  const at700 = near(700);
  const at950 = near(950);
  const shown = [at400, at700, at950].map((sample) => sample.t + "ms:" + (sample.o == null ? "gone" : sample.o.toFixed(2))).join(" ");
  const fading = [at400, at700, at950].every((sample) => sample.o != null && sample.o > 0.04 && sample.o < 0.96);
  check(label + " opacity stays between 0 and 1 during the fade", fading && at400.o > at700.o && at700.o > at950.o, shown);
  check(label + " fade is still running almost a second later", at950.o != null && at950.o > 0.04, shown);
  if (!reduced) check("full motion drifts and scales the text", trace.moved && trace.moved !== "none" && trace.moved !== "gone", String(trace.moved));
  else check("reduced motion keeps the text still", trace.moved === "none", String(trace.moved));
  await page.waitForTimeout(800);
  check(label + " splash is gone after the fade", await page.locator("#memorial-splash").count() === 0);
  await session.context.close();
}

await fadeSamples(false, "no-preference");
await fadeSamples(true, "reduced-motion");

async function captureMid(reduced, label) {
  const session = await open(reduced);
  await session.page.waitForTimeout(500);
  await session.page.locator("#memorial-splash").click();
  await session.page.waitForTimeout(550);
  const value = await opacity(session.page);
  await session.page.screenshot({ path: `/opt/cursor/artifacts/splash-mid-fade-${label}.png` });
  check(label + " mid-fade frame was captured while still visible", value != null && value > 0.05 && value < 0.95, value == null ? "gone" : value.toFixed(2));
  await session.context.close();
}
await captureMid(false, "no-preference");
await captureMid(true, "reduced-motion");

const hold = await open(false);
check("splash is still up before two seconds", await hold.page.locator("#memorial-splash").isVisible());
await hold.page.waitForTimeout(2400);
const midAuto = await opacity(hold.page);
check("auto fade is underway after two seconds", midAuto != null && midAuto > 0.05 && midAuto < 0.95, String(midAuto));
await hold.page.screenshot({ path: "/opt/cursor/artifacts/splash-mid-fade-auto.png" });
await hold.page.waitForTimeout(1400);
check("auto fade finishes", await hold.page.locator("#memorial-splash").count() === 0);
await hold.context.close();

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
