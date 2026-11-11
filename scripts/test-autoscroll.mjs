import { chromium } from "playwright-core";

const base = process.env.BASE_URL || "http://127.0.0.1:8765";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-gpu"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: iphone,
});
const page = await context.newPage();
await page.goto(base + "/tefila/shacharit.html", { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.removeItem("tefila-scroll-lpm:shacharit");
  localStorage.removeItem("tefila-font");
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, Math.min(4000, document.documentElement.scrollHeight * 0.45));
});
await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function scrollY() {
  return page.evaluate(() => window.scrollY);
}
async function panelInView(id) {
  const box = await page.locator(id).boundingBox();
  return !!box && box.y >= 0 && box.y < 844 && box.y + box.height <= 900;
}
const deep = await scrollY();
check("scrolled into the prayer", deep > 1500, String(Math.round(deep)));

for (let i = 0; i < 3; i++) {
  const before = await scrollY();
  await page.locator("#font-slider-toggle").click();
  const opened = await scrollY();
  check("font panel " + (i + 1) + " stays put", Math.abs(opened - before) <= 2 && await panelInView("#font-panel"), "dy " + (opened - before).toFixed(1));
  await page.locator("#font-panel-close").click();
  const closed = await scrollY();
  check("font panel " + (i + 1) + " close stays put", Math.abs(closed - before) <= 2 && await page.locator("#font-panel").isHidden(), "dy " + (closed - before).toFixed(1));
}
for (let i = 0; i < 3; i++) {
  const before = await scrollY();
  await page.locator("#scroll-toggle").click();
  const opened = await scrollY();
  check("scroll panel " + (i + 1) + " stays put", Math.abs(opened - before) <= 2 && await panelInView("#scroll-panel"), "dy " + (opened - before).toFixed(1));
  await page.keyboard.press("Escape");
  const closed = await scrollY();
  check("scroll panel " + (i + 1) + " close stays put", Math.abs(closed - before) <= 2 && await page.locator("#scroll-panel").isHidden(), "dy " + (closed - before).toFixed(1));
}

await page.locator("#scroll-toggle").click();
check("speed unit is lines per minute", (await page.locator("#scroll-value").innerText()).includes("שורות לדקה"));

async function measure(ms) {
  const y0 = await scrollY();
  await page.waitForTimeout(ms);
  const y1 = await scrollY();
  return y1 - y0;
}
async function setSpeed(n) {
  await page.locator("#scroll-speed").evaluate((el, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, n);
}

const line = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("p.t")).lineHeight));
await setSpeed(12);
await page.locator("#scroll-play").click();
const slow = await measure(1200);
const slowExpected = (12 / 60) * line * 1.2;
check("steady scroll at 12 lines/minute", slow > 4 && Math.abs(slow - slowExpected) / slowExpected < 0.35, slow.toFixed(1) + " vs " + slowExpected.toFixed(1));
check("playing collapses to the pause button", await page.locator("#scroll-panel").isHidden() && await page.locator("#scroll-float").isVisible());

await page.locator("#scroll-toggle").click();
await setSpeed(24);
await page.locator("#scroll-panel-close").click();
const fast = await measure(1200);
const fastExpected = (24 / 60) * line * 1.2;
check("faster setting scrolls about twice as fast", fast > slow * 1.5 && Math.abs(fast - fastExpected) / fastExpected < 0.35, fast.toFixed(1) + " vs " + fastExpected.toFixed(1));

const yPause = await scrollY();
await page.evaluate(() => document.body.dispatchEvent(new Event("touchstart", { bubbles: true })));
const afterTouch = await measure(500);
check("touch pauses auto-scroll", afterTouch < 4, afterTouch.toFixed(1) + " after " + Math.round(yPause));

await page.locator("#scroll-toggle").click();
await page.locator("#scroll-play").click();
const resumed = await measure(700);
check("play resumes auto-scroll", resumed > 4, resumed.toFixed(1));

await page.evaluate(() => document.body.dispatchEvent(new Event("touchstart", { bubbles: true })));
await page.locator("#scroll-toggle").click();
await page.locator("#scroll-play").click();
const anchor = await page.evaluate(() => {
  const mark = window.innerHeight * 0.3;
  const el = [...document.querySelectorAll("p.t")].find((node) => {
    const rect = node.getBoundingClientRect();
    return rect.height > 8 && rect.top <= mark && rect.bottom >= mark;
  });
  el.dataset.fontAnchor = "1";
  return el.getBoundingClientRect().top;
});
await page.locator("#font-inc").click();
await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const drift = await page.evaluate((top) => Math.abs(document.querySelector("[data-font-anchor]").getBoundingClientRect().top - top), anchor);
check("text size mid-scroll does not jump", drift <= 8, "drift " + drift.toFixed(1));

const stored = await page.evaluate(() => localStorage.getItem("tefila-scroll-lpm:shacharit"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator("#scroll-toggle").click();
const again = await page.locator("#scroll-speed").inputValue();
const idle = await measure(400);
check("speed is remembered and playback is not", again === stored && idle < 3, again + " idle " + idle.toFixed(1));

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
