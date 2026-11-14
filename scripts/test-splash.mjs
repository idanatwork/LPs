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

async function open(reduced, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({
    viewport,
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
await shown.page.waitForTimeout(180);
const fadeIn = await shown.page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".memorial-card")).opacity));
check("dedication text fades in", fadeIn > 0.05 && fadeIn < 0.98, fadeIn.toFixed(2));
const got = await splash.locator("p").allInnerTexts();
check("dedication text is exact", got.join("\n") === lines.join("\n"), got.join(" | "));
check("splash shows no English letters", !/[A-Za-z]/.test(await splash.innerText()));
const look = await shown.page.evaluate(() => {
  const splash = document.getElementById("memorial-splash");
  const name = splash.querySelector(".memorial-name");
  const flame = splash.querySelector(".memorial-flame");
  const css = [...document.styleSheets].some((sheet) => {
    try { return [...sheet.cssRules].some((rule) => rule.cssText && rule.cssText.includes("safe-area-inset-top")); }
    catch (e) { return false; }
  });
  return {
    bg: getComputedStyle(splash).backgroundColor,
    name: getComputedStyle(name).color,
    candles: splash.querySelectorAll(".memorial-candle").length,
    frame: splash.querySelectorAll(".memorial-frame").length,
    flicker: getComputedStyle(flame).animationName,
    safe: css,
    kicker: parseFloat(getComputedStyle(splash.querySelector(".memorial-kicker")).fontSize),
    nameSize: parseFloat(getComputedStyle(name).fontSize),
    detail: parseFloat(getComputedStyle(splash.querySelector(".memorial-story")).fontSize),
    tnc: parseFloat(getComputedStyle(splash.querySelector(".memorial-tnc")).fontSize),
    wrap: getComputedStyle(name).textWrap,
  };
});
check("kicker is about 26 to 30px", look.kicker >= 26 && look.kicker <= 30, String(look.kicker));
check("name is about 40 to 46px", look.nameSize >= 40 && look.nameSize <= 46, String(look.nameSize));
check("detail lines are about 20 to 22px", look.detail >= 20 && look.detail <= 22, String(look.detail));
check("closing line is about 26 to 28px", look.tnc >= 26 && look.tnc <= 28, String(look.tnc));
check("name wraps with balance", look.wrap === "balance", look.wrap);
check("splash background is deep navy", look.bg === "rgb(3, 2, 31)", look.bg);
check("name is warm gold", look.name === "rgb(212, 164, 106)", look.name);
check("two candles flank the closing line", look.candles === 2 && look.frame === 1, JSON.stringify(look));
check("flames flicker unless motion is reduced", look.flicker.includes("memorial-flicker"), look.flicker);
check("frame stays inside the safe area", look.safe);
await shown.page.waitForTimeout(800);
await splash.screenshot({ path: "/opt/cursor/artifacts/memorial-splash-iphone.png" });
await shown.context.close();

async function fadeSamples(reduced, label) {
  const session = await open(reduced);
  const page = session.page;
  const flameBefore = await page.evaluate(() => getComputedStyle(document.querySelector(".memorial-flame")).animationName);
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
  else {
    check("reduced motion keeps the text still", trace.moved === "none", String(trace.moved));
    check("reduced motion holds the flames still", flameBefore === "none", flameBefore);
  }
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

async function fits(width, height) {
  const session = await open(false, { width, height });
  await session.page.waitForTimeout(700);
  const fit = await session.page.evaluate(() => {
    const splash = document.getElementById("memorial-splash");
    const frame = splash.querySelector(".memorial-frame").getBoundingClientRect();
    const foot = splash.querySelector(".memorial-foot").getBoundingClientRect();
    const outside = [];
    for (const node of splash.querySelectorAll(".memorial-copy p, .memorial-tnc, .memorial-candle, .memorial-wax")) {
      const rect = node.getBoundingClientRect();
      if (rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1 || rect.bottom > window.innerHeight + 1 || rect.left < frame.left - 2 || rect.right > frame.right + 2) {
        outside.push(node.className || node.tagName);
      }
    }
    const date = splash.querySelector(".memorial-date").getBoundingClientRect();
    const textTop = splash.querySelector(".memorial-kicker").getBoundingClientRect().top;
    const textMid = (textTop + date.bottom) / 2;
    const bandMid = (frame.top + foot.top) / 2;
    return {
      outside,
      center: Math.abs(textMid - bandMid),
      gap: Math.round(foot.top - date.bottom),
    };
  });
  const shot = width === 390 ? "/opt/cursor/artifacts/memorial-splash-iphone.png" : `/opt/cursor/artifacts/memorial-splash-${width}x${height}.png`;
  await session.page.locator("#memorial-splash").screenshot({ path: shot });
  check(`${width}x${height} splash fits inside the frame`, fit.outside.length === 0 && fit.gap > 24, JSON.stringify(fit));
  check(`${width}x${height} text sits between the frame and the candles`, fit.center < 48, "off by " + fit.center.toFixed(1));
  await session.context.close();
}
await fits(375, 667);
await fits(390, 844);
await fits(430, 932);

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
