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
  document.documentElement.style.scrollBehavior = "auto";
  const y = (document.documentElement.scrollHeight - window.innerHeight) / 2;
  window.scrollTo(0, y);
});
await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

const before = await page.evaluate(() => {
  const line = window.innerHeight * 0.3;
  const el = [...document.querySelectorAll("p.t")].find((node) => {
    const rect = node.getBoundingClientRect();
    return rect.height > 8 && rect.top <= line && rect.bottom >= line;
  });
  if (!el) return null;
  el.dataset.fontAnchor = "1";
  const header = document.querySelector("header.bar").getBoundingClientRect();
  return {
    top: el.getBoundingClientRect().top,
    headerTop: header.top,
    headerHeight: header.height,
    fs: parseInt(getComputedStyle(document.documentElement).getPropertyValue("--fs"), 10),
  };
});
check("found a paragraph at the reading line", !!before, before && String(Math.round(before.top)));

async function settle() {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function sample() {
  return page.evaluate(() => {
    const el = document.querySelector("[data-font-anchor]");
    const header = document.querySelector("header.bar").getBoundingClientRect();
    return {
      top: el.getBoundingClientRect().top,
      headerTop: header.top,
      headerHeight: header.height,
      fs: parseInt(getComputedStyle(document.documentElement).getPropertyValue("--fs"), 10),
    };
  });
}

await page.locator("#font-slider-toggle").evaluate((el) => el.click());
let mark = before;
for (let i = 0; i < 4; i++) {
  await page.locator("#font-inc").evaluate((el) => el.click());
  await settle();
  const now = await sample();
  const drift = Math.abs(now.top - mark.top);
  check("plus " + (i + 1) + " keeps the paragraph", drift <= 8 && now.fs > mark.fs, "drift " + drift.toFixed(1) + "px, " + mark.fs + "→" + now.fs);
  check("plus " + (i + 1) + " keeps the header bar", Math.abs(now.headerTop - mark.headerTop) <= 1 && now.headerHeight === mark.headerHeight, "header " + now.headerTop.toFixed(1) + "/" + now.headerHeight);
  mark = now;
}
for (let i = 0; i < 4; i++) {
  await page.locator("#font-dec").evaluate((el) => el.click());
  await settle();
  const now = await sample();
  const drift = Math.abs(now.top - mark.top);
  check("minus " + (i + 1) + " keeps the paragraph", drift <= 8 && now.fs < mark.fs, "drift " + drift.toFixed(1) + "px, " + mark.fs + "→" + now.fs);
  check("minus " + (i + 1) + " keeps the header bar", Math.abs(now.headerTop - mark.headerTop) <= 1 && now.headerHeight === mark.headerHeight, "header " + now.headerTop.toFixed(1) + "/" + now.headerHeight);
  mark = now;
}

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
