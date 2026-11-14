import { webkit } from "playwright-core";
import { mkdirSync } from "fs";

const base = process.env.BASE_URL || "http://127.0.0.1:8765";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

mkdirSync("/opt/cursor/artifacts", { recursive: true });
const browser = await webkit.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: iphone,
});
const page = await context.newPage();
await page.addInitScript(() => sessionStorage.setItem("tefila-splash", "1"));
await page.goto(base + "/tefila/shacharit.html", { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  localStorage.removeItem("tefila-scroll-continue");
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, Math.min(4000, document.documentElement.scrollHeight * 0.35));
});
await page.locator("#scroll-toggle").evaluate((el) => el.click());
await page.locator("#scroll-panel").screenshot({ path: "/opt/cursor/artifacts/scroll-keep-panel-iphone.png" });
const label = (await page.locator(".scroll-keep-text").innerText()).trim();
check("panel shows the Hebrew continue option", label === "המשך גלילה גם בזמן גלילה ידנית" && !/[A-Za-z]/.test(await page.locator("#scroll-panel").innerText()), label);
check("continue option starts unchecked", await page.locator("#scroll-keep").isChecked() === false);
const size = await page.evaluate(() => {
  const panel = document.querySelector("#scroll-panel");
  const row = panel.querySelector(".font-panel-row");
  const keep = panel.querySelector(".scroll-keep");
  return {
    keepH: keep.getBoundingClientRect().height,
    keepW: Math.round(keep.getBoundingClientRect().width),
    rowW: Math.round(row.getBoundingClientRect().width),
  };
});
check("checkbox row is full width and at least 44px", size.keepH >= 44 && size.keepW >= size.rowW - 2, JSON.stringify(size));

async function y() { return page.evaluate(() => window.scrollY); }
await page.locator("#scroll-keep").evaluate((el) => {
  el.checked = true;
  el.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.locator("#scroll-speed").evaluate((el) => {
  const value = 80;
  const unit = Math.log(value / 20) / Math.log(500 / 20);
  el.value = String(Math.round(unit * 100));
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.locator("#scroll-play").evaluate((el) => el.click());
await page.waitForTimeout(350);
const marked = await y();
await page.evaluate((top) => window.scrollTo(0, Math.max(0, top - 800)), marked);
await page.waitForTimeout(200);
const held = await y();
await page.waitForTimeout(650);
const continued = await y();
check("checked: manual scroll keeps auto-scroll going", (await page.locator("#scroll-float").getAttribute("aria-label")) === "עצור" && continued > held + 4 && continued < marked - 300, Math.round(held) + " → " + Math.round(continued) + " (was " + Math.round(marked) + ")");
await page.evaluate(() => document.body.dispatchEvent(new Event("touchstart", { bubbles: true })));
const during = await y();
await page.waitForTimeout(280);
const dragged = await y();
await page.evaluate(() => document.body.dispatchEvent(new Event("touchend", { bubbles: true })));
check("checked: a finger hold does not stop it", dragged - during < 6 && (await page.locator("#scroll-float").getAttribute("aria-label")) === "עצור", (dragged - during).toFixed(1));
const beforeLift = await y();
await page.waitForTimeout(1000);
check("checked: it resumes after the finger lifts", (await y()) > beforeLift + 6, Math.round(beforeLift) + " → " + Math.round(await y()));

await page.locator("#scroll-pace").evaluate((el) => el.click());
await page.locator("#scroll-keep").evaluate((el) => {
  el.checked = false;
  el.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.locator("#scroll-panel-close").evaluate((el) => el.click());
await page.evaluate(() => document.body.dispatchEvent(new Event("touchstart", { bubbles: true })));
const stoppedAt = await y();
await page.waitForTimeout(400);
check("unchecked: a touch still pauses", (await y()) - stoppedAt < 4 && (await page.locator("#scroll-float").getAttribute("aria-label")) === "המשך", ((await y()) - stoppedAt).toFixed(1));

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
