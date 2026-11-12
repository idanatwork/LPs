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
  viewport: { width: 393, height: 852 },
  isMobile: true,
  hasTouch: true,
  userAgent: iphone,
});
const page = await context.newPage();

async function scrollY() {
  return page.evaluate(() => window.scrollY);
}
async function middle() {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, Math.min(4000, (document.documentElement.scrollHeight - window.innerHeight) / 2));
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function delta(action) {
  const before = await scrollY();
  await action();
  const after = await scrollY();
  return after - before;
}

const pages = [
  ["/tefila/shacharit.html", "#s9"],
  ["/tefila/mincha.html", "#s2"],
  ["/tefila/arvit.html", "#s2"],
  ["/brachot/birkat-hamazon.html", "#b2"],
  ["/brachot/meein-shalosh.html", "#m1"],
];

for (const [path, anchor] of pages) {
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await middle();
  const openDy = await delta(() => page.locator("#toc-toggle").evaluate((el) => el.click()));
  const open = await page.locator("#toc-panel").isVisible();
  check(path + " contents open keeps the place", open && Math.abs(openDy) <= 2, "dy " + openDy.toFixed(1));
  const closeDy = await delta(() => page.locator("#toc-panel-close").evaluate((el) => el.click()));
  check(path + " contents close keeps the place", await page.locator("#toc-panel").isHidden() && Math.abs(closeDy) <= 2, "dy " + closeDy.toFixed(1));
  await page.locator("#toc-toggle").evaluate((el) => el.click());
  const escapeDy = await delta(() => page.keyboard.press("Escape"));
  check(path + " contents escape keeps the place", await page.locator("#toc-panel").isHidden() && Math.abs(escapeDy) <= 2, "dy " + escapeDy.toFixed(1));
  await page.locator("#toc-toggle").evaluate((el) => el.click());
  const backdropDy = await delta(() => page.evaluate(() => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))));
  check(path + " contents backdrop keeps the place", await page.locator("#toc-panel").isHidden() && Math.abs(backdropDy) <= 2, "dy " + backdropDy.toFixed(1));

  if (await page.locator("#font-slider-toggle").count()) {
    const fontDy = await delta(() => page.locator("#font-slider-toggle").evaluate((el) => el.click()));
    const fontClose = await delta(() => page.locator("#font-panel-close").evaluate((el) => el.click()));
    check(path + " size panel keeps the place", Math.abs(fontDy) <= 2 && Math.abs(fontClose) <= 2, fontDy.toFixed(1) + " / " + fontClose.toFixed(1));
  }
  if (await page.locator("#scroll-toggle").count()) {
    const speedDy = await delta(() => page.locator("#scroll-toggle").evaluate((el) => el.click()));
    const speedClose = await delta(() => page.keyboard.press("Escape"));
    check(path + " speed panel keeps the place", Math.abs(speedDy) <= 2 && Math.abs(speedClose) <= 2, speedDy.toFixed(1) + " / " + speedClose.toFixed(1));
  }
}

await page.goto(base + "/tefila/shacharit.html", { waitUntil: "domcontentloaded" });
await middle();
await page.evaluate(() => {
  document.getElementById("toc-toggle").click();
  document.querySelector("#toc-panel a[href='#s9']").click();
});
await page.waitForFunction(() => {
  const header = document.querySelector("header.bar").getBoundingClientRect().bottom;
  const title = document.getElementById("s9").getBoundingClientRect().top;
  return title >= header - 2 && title < header + 28;
}, null, { timeout: 12000 });
const place = await page.evaluate(() => {
  const header = document.querySelector("header.bar").getBoundingClientRect().bottom;
  const title = document.getElementById("s9").getBoundingClientRect().top;
  return { header, title, open: !document.getElementById("toc-panel").hidden };
});
check("contents entry lands under the header", place.title >= place.header - 2 && place.title < place.header + 28 && !place.open, JSON.stringify(place));

await middle();
await page.locator("#scroll-toggle").evaluate((el) => el.click());
await page.locator("#scroll-play").evaluate((el) => el.click());
const moving = await page.evaluate(() => new Promise((resolve) => {
  const y = window.scrollY;
  setTimeout(() => resolve(window.scrollY - y), 400);
}));
await page.locator("#toc-toggle").evaluate((el) => el.click());
const still = await page.evaluate(() => document.getElementById("scroll-float").getAttribute("aria-label"));
check("contents does not stop auto-scroll", moving > 2 && still === "עצור" && await page.locator("#toc-panel").isVisible(), "moved " + moving.toFixed(1) + " " + still);

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
