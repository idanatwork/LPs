import { chromium } from "playwright-core";

const base = process.env.BASE_URL || "http://127.0.0.1:8765";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const desktop = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const ipadDesktop = mac;
const prayers = ["shacharit.html", "mincha.html", "arvit.html"];
const endHref = "shortcuts://run-shortcut?name=" + encodeURIComponent("תפילה OFF");
const endLabel = "הפעל קיצור, סיים תפילה";

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-gpu"],
});

async function open(ua, extra) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: ua === iphone,
    hasTouch: ua !== desktop,
    userAgent: ua,
  });
  if (extra) await context.addInitScript(extra);
  const page = await context.newPage();
  return { context, page };
}

async function noStart(page, where) {
  const starts = await page.locator("[data-shortcut=start], .shortcut-start").count();
  const text = await page.locator("body").innerText();
  check(where + " has no start button", starts === 0 && !text.includes("אתחיל תפילה"));
}

{
  const { context, page } = await open(iphone);
  await page.goto(base + "/tefila/index.html", { waitUntil: "domcontentloaded" });
  check("gate has no shortcut row", await page.locator(".shortcut-row").count() === 0);
  await noStart(page, "gate");
  for (const name of prayers) {
    await page.goto(base + "/tefila/" + name, { waitUntil: "domcontentloaded" });
    const rows = page.locator(".shortcut-row");
    const link = rows.locator("a");
    check(name + " has one end button", await rows.count() === 1 && await link.count() === 1 && await link.isVisible());
    check(name + " end label", (await link.innerText()) === endLabel && (await link.getAttribute("aria-label")) === endLabel);
    check(name + " end href", (await link.getAttribute("href")) === endHref, await link.getAttribute("href"));
    const box = await link.boundingBox();
    check(name + " button is at least 48px", box && box.height >= 48, box && String(Math.round(box.height)));
    const sources = page.locator("h2", { hasText: "מקורות" });
    const linkBox = await link.boundingBox();
    const sourcesBox = await sources.boundingBox();
    check(name + " button is before the sources", linkBox && sourcesBox && linkBox.y < sourcesBox.y);
    await noStart(page, name);
  }
  await context.close();
}

{
  const { context, page } = await open(desktop);
  await page.goto(base + "/tefila/shacharit.html", { waitUntil: "domcontentloaded" });
  check("desktop hides the end button", await page.locator(".shortcut-row").isHidden());
  await page.goto(base + "/tefila/shacharit.html?showShortcuts=1", { waitUntil: "domcontentloaded" });
  check("desktop override shows the end button", await page.locator(".shortcut-row").isVisible());
  check("override keeps the end href", (await page.locator("[data-shortcut=end]").getAttribute("href")) === endHref);
  await context.close();
}

{
  const { context, page } = await open(mac);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(base + "/tefila/shacharit.html", { waitUntil: "domcontentloaded" });
  const link = page.locator(".shortcut-row a");
  check("Mac shows the end button", await link.count() === 1 && await link.isVisible());
  check("Mac end label", (await link.innerText()) === endLabel);
  await context.close();
}

{
  const { context, page } = await open(windows);
  await page.goto(base + "/tefila/mincha.html", { waitUntil: "domcontentloaded" });
  check("Windows hides the end button", await page.locator(".shortcut-row").isHidden());
  await context.close();
}

{
  const { context, page } = await open(ipadDesktop, () => {
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
  });
  await page.goto(base + "/tefila/arvit.html", { waitUntil: "domcontentloaded" });
  check("iPad desktop mode shows the end button", await page.locator(".shortcut-row").isVisible());
  await context.close();
}

const creditPages = [
  "/tefila/index.html",
  "/tefila/shacharit.html",
  "/tefila/mincha.html",
  "/tefila/arvit.html",
  "/tefila/zmanim.html",
  "/brachot/asher-yatzar.html",
  "/brachot/borei-nefashot.html",
  "/brachot/meein-shalosh.html",
  "/brachot/birkat-hamazon.html",
];
const creditText = "נבנה ע\"י טק-מייט | Tech-Mate";

{
  const { context, page } = await open(iphone);
  for (const path of creditPages) {
    await page.goto(base + path, { waitUntil: "domcontentloaded" });
    const credit = page.locator("main .site-credit");
    const link = credit.locator("a");
    check(path + " credit text", (await credit.innerText()) === creditText, await credit.innerText());
    check(path + " credit link", (await link.getAttribute("href")) === "https://brand.page/Tech-Mate" && (await link.getAttribute("target")) === "_blank" && (await link.getAttribute("rel")) === "noopener");
    check(path + " credit is the last line", await page.locator("main > :last-child").evaluate((el) => el.classList.contains("site-credit")));
    const style = await credit.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { align: cs.textAlign, size: cs.fontSize, color: cs.color };
    });
    check(path + " credit is small and centered", style.align === "center" && style.size === "13px", JSON.stringify(style));
  }
  await page.goto(base + "/tefila/index.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const dark = await page.locator(".site-credit").evaluate((el) => getComputedStyle(el).color);
  check("gate credit uses the dark muted color", dark === "rgb(196, 184, 168)", dark);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  const light = await page.locator(".site-credit").evaluate((el) => getComputedStyle(el).color);
  check("gate credit uses the light muted color", light === "rgb(92, 83, 72)", light);
  await context.close();
}

{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "dark",
    userAgent: iphone,
  });
  const page = await context.newPage();
  await page.goto(base + "/brachot/asher-yatzar.html", { waitUntil: "domcontentloaded" });
  const color = await page.locator(".site-credit").evaluate((el) => getComputedStyle(el).color);
  check("asher yatzar credit follows dark mode", color === "rgb(165, 157, 144)", color);
  await context.close();
}

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
